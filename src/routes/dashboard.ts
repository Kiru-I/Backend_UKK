import { Hono } from 'hono';
import { db } from '../db';
import { reimbursements, travelRequests, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { eq, sql } from 'drizzle-orm';

const dashboardRoutes = new Hono();

dashboardRoutes.use('*', authMiddleware);

dashboardRoutes.get('/stats', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin' && user.role !== 'Admin Travel' && user.role !== 'Atasan') {
    return c.json({ error: 'Forbidden', message: 'You do not have permission to access dashboard analytics.' }, 403);
  }

  const [upcoming] = await db.select({ count: sql<number>`count(*)` }).from(travelRequests).where(eq(travelRequests.status, 'APPROVED'));
  const [ongoing] = await db.select({ count: sql<number>`count(*)` }).from(travelRequests).where(eq(travelRequests.status, 'FULFILLED'));
  const [completed] = await db.select({ count: sql<number>`count(*)` }).from(travelRequests).where(eq(travelRequests.status, 'COMPLETED'));

  return c.json({
    upcoming: Number(upcoming.count),
    ongoing: Number(ongoing.count),
    completed: Number(completed.count),
  });
});

dashboardRoutes.get('/expenses', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin' && user.role !== 'Tim Keuangan' && user.role !== 'Admin Travel') {
    return c.json({ error: 'Forbidden', message: 'You do not have permission to access expense reports.' }, 403);
  }

  const expenseSummary = await db.select({
    employee_name: users.name,
    department: users.department,
    total: sql<number>`coalesce(sum(${reimbursements.total_amount}), 0)`,
  })
    .from(reimbursements)
    .leftJoin(users, eq(reimbursements.user_id, users.id))
    .groupBy(users.id, users.name, users.department);

  return c.json({ expenses: expenseSummary });
});

export default dashboardRoutes;
