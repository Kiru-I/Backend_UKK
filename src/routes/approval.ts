import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { travelApprovals, travelRequests, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';

const approvalRoutes = new Hono();

const approveSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().max(2000).optional(),
});

approvalRoutes.use('*', authMiddleware);

approvalRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Atasan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only managers can view approvals.' }, 403);
  }

  const conditions = [eq(travelRequests.status, 'PENDING'), eq(users.role, 'Karyawan')];
  if (user.role === 'Atasan') {
    conditions.push(eq(users.supervisor_id, user.id));
  }

  const pending = await db.select({
    id: travelRequests.id,
    user_id: travelRequests.user_id,
    applicant_name: users.name,
    applicant_role: users.role,
    department: users.department,
    destination: travelRequests.destination,
    start_date: travelRequests.start_date,
    end_date: travelRequests.end_date,
    estimated_cost: travelRequests.estimated_cost,
    purpose: travelRequests.purpose,
    transportation_mode: travelRequests.transportation_mode,
    document_url: travelRequests.document_url,
    status: travelRequests.status,
    created_at: travelRequests.created_at,
  })
    .from(travelRequests)
    .innerJoin(users, eq(travelRequests.user_id, users.id))
    .where(and(...conditions))
    .orderBy(desc(travelRequests.created_at));

  return c.json({ pending });
});

approvalRoutes.get('/history', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Atasan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only managers can view approval history.' }, 403);
  }

  const historyRows = await db.select({
    approval_id: travelApprovals.id,
    travel_request_id: travelRequests.id,
    applicant_id: users.id,
    applicant_name: users.name,
    applicant_role: users.role,
    department: users.department,
    destination: travelRequests.destination,
    start_date: travelRequests.start_date,
    end_date: travelRequests.end_date,
    estimated_cost: travelRequests.estimated_cost,
    decision: travelApprovals.status,
    notes: travelApprovals.notes,
    processed_at: travelApprovals.created_at,
    approver_id: travelApprovals.approver_id,
  })
    .from(travelApprovals)
    .innerJoin(travelRequests, eq(travelApprovals.travel_request_id, travelRequests.id))
    .innerJoin(users, eq(travelRequests.user_id, users.id))
    .where(user.role === 'Atasan'
      ? and(
        eq(users.role, 'Karyawan'),
        eq(travelApprovals.approver_id, user.id),
        eq(users.supervisor_id, user.id),
      )
      : eq(users.role, 'Karyawan'))
    .orderBy(desc(travelApprovals.created_at));

  const approvers = historyRows.length
    ? await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, [...new Set(historyRows.map((row) => row.approver_id))]))
    : [];
  const approverById = new Map(approvers.map((approver) => [approver.id, approver]));

  return c.json({
    history: historyRows.map((row) => ({
      ...row,
      approver: approverById.get(row.approver_id) ?? null,
    })),
  });
});

approvalRoutes.post('/:id/action', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Atasan' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only managers can approve travel requests.' }, 403);
  }

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'Travel request id must be a positive number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [request] = await db.select({
    id: travelRequests.id,
    user_id: travelRequests.user_id,
    applicant_role: users.role,
    supervisor_id: users.supervisor_id,
  })
    .from(travelRequests)
    .innerJoin(users, eq(travelRequests.user_id, users.id))
    .where(eq(travelRequests.id, id))
    .limit(1);
  if (!request) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }
  if (request.applicant_role !== 'Karyawan') {
    return c.json({ error: 'Forbidden', message: 'Only employee travel requests can be processed.' }, 403);
  }
  if (user.role === 'Atasan' && request.supervisor_id !== user.id) {
    return c.json({ error: 'Forbidden', message: 'You can only process requests from your assigned employees.' }, 403);
  }

  const nextStatus = parsed.data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const processed = await db.transaction(async (tx) => {
    const [updated] = await tx.update(travelRequests)
      .set({ status: nextStatus, updated_at: new Date() })
      .where(and(eq(travelRequests.id, id), eq(travelRequests.status, 'PENDING')));

    if (updated.affectedRows !== 1) {
      return false;
    }

    await tx.insert(travelApprovals).values({
      travel_request_id: request.id,
      approver_id: user.id,
      status: parsed.data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      notes: parsed.data.notes || null,
    });

    return true;
  });

  if (!processed) {
    return c.json({
      error: 'Conflict',
      message: 'Only pending requests can be processed; this request may already have a decision.',
    }, 409);
  }

  return c.json({
    message: `Travel request ${parsed.data.action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
    status: nextStatus,
  });
});

export default approvalRoutes;
