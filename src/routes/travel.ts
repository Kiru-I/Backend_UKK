import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { mkdir } from 'node:fs/promises';
import { db } from '../db';
import { cashAdvances, transportationModes, travelRequests, travelApprovals } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { getTravelTracking } from '../lib/travel-tracking';

const travelRoutes = new Hono();

const createTravelSchema = z.object({
  destination: z.string().min(2),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  purpose: z.string().min(5),
  transportation_mode: z.enum(transportationModes).optional(),
  document_url: z.string().url().optional().or(z.literal('')),
});

async function saveUploadedDocument(file: File) {
  const uploadDir = './uploads/travel-documents';
  await mkdir(uploadDir, { recursive: true });

  const originalName = file.name || 'document';
  const extension = originalName.includes('.') ? `.${originalName.split('.').pop()?.toLowerCase() || 'bin'}` : '';
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const absolutePath = `${uploadDir}/${fileName}`;

  await Bun.write(absolutePath, file);

  const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${baseUrl}/uploads/travel-documents/${fileName}`;
}

travelRoutes.use('*', authMiddleware);

travelRoutes.post('/', async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('Content-Type') || '';

  let destination = '';
  let start_date = '';
  let end_date = '';
  let purpose = '';
  let transportation_mode: string | undefined;
  let document_url = '';
  let uploadedFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    destination = String(formData.get('destination') || '');
    start_date = String(formData.get('start_date') || '');
    end_date = String(formData.get('end_date') || '');
    purpose = String(formData.get('purpose') || '');
    transportation_mode = String(formData.get('transportation_mode') || '') || undefined;
    document_url = String(formData.get('document_url') || '');
    uploadedFile = formData.get('document') as File | null;
  } else {
    const body = await c.req.json().catch(() => null);

    if (!body) {
      return c.json({ error: 'Bad Request', message: 'Request body or multipart form-data is required.' }, 400);
    }

    destination = body.destination || '';
    start_date = body.start_date || '';
    end_date = body.end_date || '';
    purpose = body.purpose || '';
    transportation_mode = body.transportation_mode || undefined;
    document_url = body.document_url || '';
  }

  let finalDocumentUrl = document_url || null;

  if (uploadedFile && uploadedFile.size > 0) {
    if (!uploadedFile.name) {
      return c.json({ error: 'Bad Request', message: 'The uploaded document is invalid.' }, 400);
    }

    finalDocumentUrl = await saveUploadedDocument(uploadedFile);
  }

  const parsed = createTravelSchema.safeParse({
    destination,
    start_date,
    end_date,
    purpose,
    transportation_mode,
    document_url: finalDocumentUrl || '',
  });

  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const {
    destination: safeDestination,
    start_date: safeStartDate,
    end_date: safeEndDate,
    purpose: safePurpose,
    transportation_mode: safeTransportationMode,
    document_url: safeDocumentUrl,
  } = parsed.data;
  const startDate = new Date(safeStartDate);
  const endDate = new Date(safeEndDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return c.json({ error: 'Bad Request', message: 'The travel dates must be valid and the start date cannot be after the end date.' }, 400);
  }

  const [created] = await db.insert(travelRequests).values([
    {
      user_id: user.id,
      destination: safeDestination,
      start_date: startDate,
      end_date: endDate,
      purpose: safePurpose,
      transportation_mode: safeTransportationMode || null,
      document_url: safeDocumentUrl || null,
      status: 'PENDING',
    },
  ]);

  return c.json({
    message: 'Travel request submitted successfully.',
    travelRequest: {
      id: created.insertId,
      user_id: user.id,
      destination: safeDestination,
      start_date: safeStartDate,
      end_date: safeEndDate,
      purpose: safePurpose,
      transportation_mode: safeTransportationMode || null,
      document_url: safeDocumentUrl || null,
      status: 'PENDING',
    },
  }, 201);
});

travelRoutes.get('/my-requests', async (c) => {
  const user = c.get('user');
  const requests = await db.select().from(travelRequests).where(eq(travelRequests.user_id, user.id));
  const advances = await db.select().from(cashAdvances).where(eq(cashAdvances.user_id, user.id));
  const advanceByTravel = new Map<number, number>();
  for (const advance of advances) {
    if (advance.status !== 'DISBURSED') continue;
    const remaining = Math.max(0, Number(advance.requested_amount) - Number(advance.returned_amount));
    advanceByTravel.set(
      advance.travel_request_id,
      (advanceByTravel.get(advance.travel_request_id) || 0) + remaining,
    );
  }

  return c.json({
    requests: requests.map((request) => ({
      ...request,
      ...getTravelTracking(
        request.end_date,
        request.lpj_completed_at,
        advanceByTravel.get(request.id) || 0,
      ),
    })),
  });
});

travelRoutes.post('/:id/lpj', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'Travel id must be a positive number.' }, 400);
  }

  const user = c.get('user');
  const [request] = await db.select().from(travelRequests)
    .where(eq(travelRequests.id, id))
    .limit(1);
  if (!request) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }
  if (request.user_id !== user.id) {
    return c.json({ error: 'Forbidden', message: 'You can only complete LPJ for your own travel.' }, 403);
  }
  if (new Date(request.end_date) > new Date()) {
    return c.json({ error: 'Bad Request', message: 'LPJ can only be completed after the trip ends.' }, 400);
  }

  const completedAt = request.lpj_completed_at || new Date();
  if (!request.lpj_completed_at) {
    await db.update(travelRequests)
      .set({ lpj_completed_at: completedAt })
      .where(eq(travelRequests.id, id));
  }

  return c.json({
    message: 'LPJ marked as completed.',
    travel_id: id,
    lpj_status: 'Selesai',
    lpj_completed_at: completedAt,
  });
});

travelRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Bad Request', message: 'Travel id must be a number.' }, 400);
  }

  const user = c.get('user');
  const [request] = await db.select().from(travelRequests).where(eq(travelRequests.id, id)).limit(1);

  if (!request) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }

  if (request.user_id !== user.id && user.role !== 'Super Admin' && user.role !== 'Atasan' && user.role !== 'Admin Travel' && user.role !== 'Tim Keuangan') {
    return c.json({ error: 'Forbidden', message: 'You cannot access this travel request.' }, 403);
  }

  const approvals = await db.select().from(travelApprovals).where(eq(travelApprovals.travel_request_id, id));
  const advances = await db.select().from(cashAdvances)
    .where(eq(cashAdvances.travel_request_id, id));
  const remainingAdvanceAmount = advances.reduce(
    (sum, advance) => sum + (advance.status === 'DISBURSED'
      ? Math.max(0, Number(advance.requested_amount) - Number(advance.returned_amount))
      : 0),
    0,
  );

  return c.json({
    ...request,
    approvals,
    ...getTravelTracking(request.end_date, request.lpj_completed_at, remainingAdvanceAmount),
  });
});

export default travelRoutes;
