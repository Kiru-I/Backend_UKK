import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { travelFulfillments, travelRequests } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const fulfillmentRoutes = new Hono();

const fulfillmentSchema = z.object({
  transport_details: z.string().min(3),
  accommodation_details: z.string().min(3),
});

fulfillmentRoutes.use('*', authMiddleware);

fulfillmentRoutes.get('/pending', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can view fulfillment queue.' }, 403);
  }

  const pending = await db.select().from(travelRequests).where(eq(travelRequests.status, 'APPROVED'));
  return c.json({ pending });
});

fulfillmentRoutes.post('/:travelId', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can fulfill trips.' }, 403);
  }

  const travelId = Number(c.req.param('travelId'));
  if (!Number.isInteger(travelId)) {
    return c.json({ error: 'Bad Request', message: 'Travel request id must be a number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = fulfillmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [request] = await db.select().from(travelRequests).where(eq(travelRequests.id, travelId)).limit(1);
  if (!request) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }

  if (request.status !== 'APPROVED') {
    return c.json({ error: 'Bad Request', message: 'Only approved travel requests can be fulfilled.' }, 400);
  }

  const [created] = await db.insert(travelFulfillments).values({
    travel_request_id: request.id,
    transport_details: parsed.data.transport_details,
    accommodation_details: parsed.data.accommodation_details,
    admin_id: user.id,
  });

  await db.update(travelRequests)
    .set({ status: 'FULFILLED', updated_at: new Date() })
    .where(eq(travelRequests.id, travelId));

  return c.json({
    message: 'Travel fulfillment recorded successfully.',
    fulfillment: {
      id: created.insertId,
      travel_request_id: request.id,
      transport_details: parsed.data.transport_details,
      accommodation_details: parsed.data.accommodation_details,
      admin_id: user.id,
    },
  }, 201);
});

export default fulfillmentRoutes;
