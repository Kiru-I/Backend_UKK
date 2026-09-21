import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { mkdir } from 'node:fs/promises';
import { db } from '../db';
import { travelRequests, travelApprovals } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const travelRoutes = new Hono();

const createTravelSchema = z.object({
  destination: z.string().min(2),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  purpose: z.string().min(5),
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
  let document_url = '';
  let uploadedFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    destination = String(formData.get('destination') || '');
    start_date = String(formData.get('start_date') || '');
    end_date = String(formData.get('end_date') || '');
    purpose = String(formData.get('purpose') || '');
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
    document_url: finalDocumentUrl || '',
  });

  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const { destination: safeDestination, start_date: safeStartDate, end_date: safeEndDate, purpose: safePurpose, document_url: safeDocumentUrl } = parsed.data;
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
      document_url: safeDocumentUrl || null,
      status: 'PENDING',
    },
  }, 201);
});

travelRoutes.get('/my-requests', async (c) => {
  const user = c.get('user');
  const requests = await db.select().from(travelRequests).where(eq(travelRequests.user_id, user.id));
  return c.json({ requests });
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

  return c.json({
    ...request,
    approvals,
  });
});

export default travelRoutes;
