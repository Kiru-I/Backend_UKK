import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { reimbursements, reimbursementItems, travelRequests } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const reimbursementRoutes = new Hono();

const reimbursementSchema = z.object({
  items: z.array(
    z.object({
      category: z.string().min(2),
      amount: z.coerce.number().positive(),
      receipt_url: z.string().url().optional().or(z.literal('')),
      description: z.string().optional(),
    })
  ).min(1),
});

const processSchema = z.object({
  status: z.enum(['NEEDS_DOCUMENTS', 'VERIFIED', 'PAID', 'REJECTED']),
  notes: z.string().optional(),
});

const reimbursementStatusLabels = {
  SUBMITTED: 'Menunggu Verifikasi',
  NEEDS_DOCUMENTS: 'Bukti Kurang',
  VERIFIED: 'Terverifikasi',
  PAID: 'Selesai',
  REJECTED: 'Dikembalikan',
} as const;

reimbursementRoutes.use('*', authMiddleware);

reimbursementRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Tim Keuangan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only finance team can access all reimbursements.' }, 403);
  }

  const records = await db.query.reimbursements.findMany({
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          role: true,
          department: true,
        },
      },
      travelRequest: true,
      items: true,
    },
  });

  return c.json({
    reimbursements: records.map((record) => ({
      ...record,
      status_label: reimbursementStatusLabels[record.status],
    })),
  });
});

reimbursementRoutes.get('/my', async (c) => {
  const user = c.get('user');
  const records = await db.query.reimbursements.findMany({
    where: eq(reimbursements.user_id, user.id),
    with: {
      travelRequest: true,
      items: true,
    },
  });

  return c.json({
    reimbursements: records.map((record) => ({
      ...record,
      status_label: reimbursementStatusLabels[record.status],
    })),
  });
});

reimbursementRoutes.post('/:travelId', async (c) => {
  const user = c.get('user');
  const travelId = Number(c.req.param('travelId'));

  if (!Number.isInteger(travelId)) {
    return c.json({ error: 'Bad Request', message: 'Travel id must be a number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = reimbursementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [travelRequest] = await db.select().from(travelRequests).where(eq(travelRequests.id, travelId)).limit(1);
  if (!travelRequest) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }

  if (travelRequest.user_id !== user.id) {
    return c.json({ error: 'Forbidden', message: 'You can only submit reimbursements for your own travel.' }, 403);
  }

  const totalAmount = parsed.data.items.reduce((sum, item) => sum + item.amount, 0);
  const [created] = await db.insert(reimbursements).values({
    travel_request_id: travelId,
    user_id: user.id,
    total_amount: totalAmount.toFixed(2),
    status: 'SUBMITTED',
  });

  const entries = parsed.data.items.map((item) => ({
    reimbursement_id: created.insertId,
    category: item.category,
    amount: item.amount.toFixed(2),
    receipt_url: item.receipt_url || null,
    description: item.description || null,
  }));

  await db.insert(reimbursementItems).values(entries);

  return c.json({
    message: 'Reimbursement submitted successfully.',
    reimbursement: {
      id: created.insertId,
      travel_request_id: travelId,
      user_id: user.id,
      total_amount: totalAmount.toFixed(2),
      status: 'SUBMITTED',
      items: entries,
    },
  }, 201);
});

reimbursementRoutes.get('/pending', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Tim Keuangan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only finance team can access pending reimbursements.' }, 403);
  }

  const pending = await db.select().from(reimbursements).where(eq(reimbursements.status, 'SUBMITTED'));
  return c.json({ pending });
});

reimbursementRoutes.post('/:id/process', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Tim Keuangan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only finance team can process reimbursements.' }, 403);
  }

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Bad Request', message: 'Reimbursement id must be a number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = processSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }
  if (parsed.data.status === 'PAID') {
    return c.json({
      error: 'Conflict',
      message: 'Use POST /api/finance/payments/reimbursement/:id/process to record payment metadata.',
    }, 409);
  }

  const [record] = await db.select().from(reimbursements).where(eq(reimbursements.id, id)).limit(1);
  if (!record) {
    return c.json({ error: 'Not Found', message: 'Reimbursement was not found.' }, 404);
  }
  if (record.status === 'PAID') {
    return c.json({
      error: 'Conflict',
      message: 'This reimbursement is already paid.',
    }, 409);
  }
  if (record.status === 'VERIFIED' && parsed.data.status !== 'VERIFIED') {
    return c.json({
      error: 'Conflict',
      message: 'Verified reimbursements can only be completed through the Finance payment API.',
    }, 409);
  }

  const [updated] = await db.update(reimbursements)
    .set({ status: parsed.data.status })
    .where(and(
      eq(reimbursements.id, id),
      inArray(reimbursements.status, ['SUBMITTED', 'NEEDS_DOCUMENTS']),
    ));
  if (updated.affectedRows !== 1) {
    return c.json({ error: 'Conflict', message: 'This reimbursement was already processed.' }, 409);
  }

  return c.json({
    message: 'Reimbursement processed successfully.',
    reimbursement: {
      id: record.id,
      status: parsed.data.status,
      status_label: reimbursementStatusLabels[parsed.data.status],
      notes: parsed.data.notes || null,
    },
  });
});

export default reimbursementRoutes;
