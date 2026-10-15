import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { cashAdvances, travelRequests } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { getTravelTracking } from '../lib/travel-tracking';

const cashAdvanceRoutes = new Hono();

const createSchema = z.object({
  travel_id: z.coerce.number().int().positive(),
  estimated_cost: z.coerce.number().positive(),
  requested_amount: z.coerce.number().positive(),
}).refine((value) => value.requested_amount <= value.estimated_cost, {
  message: 'Requested amount cannot exceed estimated cost.',
  path: ['requested_amount'],
});

const settlementSchema = z.object({
  returned_amount: z.coerce.number().min(0),
});

cashAdvanceRoutes.use('*', authMiddleware);

cashAdvanceRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [travelRequest] = await db.select().from(travelRequests)
    .where(and(eq(travelRequests.id, parsed.data.travel_id), eq(travelRequests.user_id, user.id)))
    .limit(1);

  if (!travelRequest) {
    return c.json({ error: 'Not Found', message: 'Your travel request was not found.' }, 404);
  }

  if (travelRequest.status !== 'APPROVED' && travelRequest.status !== 'FULFILLED') {
    return c.json({ error: 'Bad Request', message: 'Cash advances can only be requested for approved trips.' }, 400);
  }

  const [created] = await db.insert(cashAdvances).values({
    travel_request_id: travelRequest.id,
    user_id: user.id,
    estimated_cost: parsed.data.estimated_cost.toFixed(2),
    requested_amount: parsed.data.requested_amount.toFixed(2),
  });

  return c.json({
    message: 'Cash advance request submitted successfully.',
    cashAdvance: {
      id: created.insertId,
      travel_id: travelRequest.id,
      estimated_cost: parsed.data.estimated_cost.toFixed(2),
      requested_amount: parsed.data.requested_amount.toFixed(2),
      returned_amount: '0.00',
      status: 'WAITING_PAYMENT',
      status_label: 'Menunggu Pembayaran',
    },
  }, 201);
});

cashAdvanceRoutes.get('/my', async (c) => {
  const user = c.get('user');
  const advances = await db.query.cashAdvances.findMany({
    where: eq(cashAdvances.user_id, user.id),
    with: { travelRequest: true },
  });

  return c.json({
    cashAdvances: advances.map(({ travelRequest, ...advance }) => ({
      ...advance,
      status_label: advance.status === 'DISBURSED' ? 'Dicairkan' : 'Menunggu Pembayaran',
      travel: {
        id: travelRequest.id,
        destination: travelRequest.destination,
        start_date: travelRequest.start_date,
        end_date: travelRequest.end_date,
      },
      ...getTravelTracking(
        travelRequest.end_date,
        travelRequest.lpj_completed_at,
        advance.status === 'DISBURSED'
          ? Math.max(0, Number(advance.requested_amount) - Number(advance.returned_amount))
          : 0,
      ),
    })),
  });
});

cashAdvanceRoutes.get('/pending', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Tim Keuangan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only finance team can view pending cash advances.' }, 403);
  }

  const pending = await db.query.cashAdvances.findMany({
    where: eq(cashAdvances.status, 'WAITING_PAYMENT'),
    with: { user: true, travelRequest: true },
  });

  return c.json({ pending });
});

cashAdvanceRoutes.post('/:id/process', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Tim Keuangan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only finance team can disburse cash advances.' }, 403);
  }

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'Cash advance id must be a positive number.' }, 400);
  }

  const [advance] = await db.select().from(cashAdvances)
    .where(eq(cashAdvances.id, id))
    .limit(1);
  if (!advance) {
    return c.json({ error: 'Not Found', message: 'Cash advance was not found.' }, 404);
  }
  if (advance.status !== 'WAITING_PAYMENT') {
    return c.json({ error: 'Bad Request', message: 'Only pending cash advances can be disbursed.' }, 400);
  }

  await db.update(cashAdvances)
    .set({ status: 'DISBURSED' })
    .where(eq(cashAdvances.id, id));

  return c.json({
    message: 'Cash advance disbursed successfully.',
    cashAdvance: { id, status: 'DISBURSED', status_label: 'Dicairkan' },
  });
});

cashAdvanceRoutes.post('/:id/settlement', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'Cash advance id must be a positive number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }
  const parsed = settlementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [advance] = await db.select().from(cashAdvances)
    .where(and(eq(cashAdvances.id, id), eq(cashAdvances.user_id, user.id)))
    .limit(1);
  if (!advance) {
    return c.json({ error: 'Not Found', message: 'Your cash advance was not found.' }, 404);
  }
  if (advance.status !== 'DISBURSED') {
    return c.json({ error: 'Bad Request', message: 'Only disbursed cash advances can be settled.' }, 400);
  }
  if (parsed.data.returned_amount > Number(advance.requested_amount)) {
    return c.json({ error: 'Bad Request', message: 'Returned amount cannot exceed the disbursed amount.' }, 400);
  }

  const [travelRequest] = await db.select().from(travelRequests)
    .where(eq(travelRequests.id, advance.travel_request_id))
    .limit(1);
  if (!travelRequest || new Date(travelRequest.end_date) > new Date()) {
    return c.json({ error: 'Bad Request', message: 'Cash advances can only be settled after the trip ends.' }, 400);
  }

  await db.update(cashAdvances)
    .set({ returned_amount: parsed.data.returned_amount.toFixed(2) })
    .where(eq(cashAdvances.id, id));

  return c.json({
    message: 'Cash advance settlement recorded successfully.',
    cashAdvance: {
      id,
      returned_amount: parsed.data.returned_amount.toFixed(2),
      remaining_amount: (Number(advance.requested_amount) - parsed.data.returned_amount).toFixed(2),
    },
  });
});

export default cashAdvanceRoutes;
