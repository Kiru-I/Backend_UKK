import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { travelRequests, travelApprovals, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const travelRoutes = new Hono();

const createTravelSchema = z.object({
  destination: z.string().min(2),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  purpose: z.string().min(5),
  document_url: z.string().url().optional().or(z.literal('')),
});

travelRoutes.use('*', authMiddleware);

travelRoutes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = createTravelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const { destination, start_date, end_date, purpose, document_url } = parsed.data;
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
    return c.json({ error: 'Bad Request', message: 'The travel dates must be valid and the start date cannot be after the end date.' }, 400);
  }

  const [created] = await db.insert(travelRequests).values([
    {
      user_id: user.id,
      destination,
      start_date: startDate,
      end_date: endDate,
      purpose,
      document_url: document_url || null,
      status: 'PENDING',
    },
  ]);

  return c.json({
    message: 'Travel request submitted successfully.',
    travelRequest: {
      id: created.insertId,
      user_id: user.id,
      destination,
      start_date,
      end_date,
      purpose,
      document_url: document_url || null,
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
