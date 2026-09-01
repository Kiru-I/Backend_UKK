import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { travelApprovals, travelRequests } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const approvalRoutes = new Hono();

const approveSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().optional(),
});

approvalRoutes.use('*', authMiddleware);

approvalRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Atasan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only managers can view approvals.' }, 403);
  }

  const pending = await db.select().from(travelRequests).where(eq(travelRequests.status, 'PENDING'));
  return c.json({ pending });
});

approvalRoutes.post('/:id/action', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Atasan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only managers can approve travel requests.' }, 403);
  }

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Bad Request', message: 'Travel request id must be a number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [request] = await db.select().from(travelRequests).where(eq(travelRequests.id, id)).limit(1);
  if (!request) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }

  const nextStatus = parsed.data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  await db.insert(travelApprovals).values({
    travel_request_id: request.id,
    approver_id: user.id,
    status: parsed.data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    notes: parsed.data.notes || null,
  });

  await db.update(travelRequests)
    .set({ status: nextStatus, updated_at: new Date() })
    .where(eq(travelRequests.id, id));

  return c.json({
    message: `Travel request ${parsed.data.action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
    status: nextStatus,
  });
});

export default approvalRoutes;
