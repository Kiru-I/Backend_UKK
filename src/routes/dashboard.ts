import { Hono } from 'hono';
import { db } from '../db';
import { cashAdvances, reimbursements, travelRequests, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { getTravelTracking } from '../lib/travel-tracking';

const dashboardRoutes = new Hono();
const annualTravelQuota = 12;

dashboardRoutes.use('*', authMiddleware);

dashboardRoutes.get('/my-summary', async (c) => {
  const user = c.get('user');
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
  const nextYearStart = new Date(Date.UTC(now.getFullYear() + 1, 0, 1));
  const [advanceSummary] = await db.select({
    running: sql<string>`coalesce(sum(${cashAdvances.requested_amount} - ${cashAdvances.returned_amount}), 0)`,
    returned: sql<string>`coalesce(sum(${cashAdvances.returned_amount}), 0)`,
  })
    .from(cashAdvances)
    .where(and(
      eq(cashAdvances.user_id, user.id),
      eq(cashAdvances.status, 'DISBURSED'),
    ));

  const [quotaSummary] = await db.select({
    used: sql<number>`count(*)`,
  })
    .from(travelRequests)
    .where(and(
      eq(travelRequests.user_id, user.id),
      gte(travelRequests.start_date, yearStart),
      lt(travelRequests.start_date, nextYearStart),
      inArray(travelRequests.status, ['APPROVED', 'FULFILLED', 'COMPLETED']),
    ));

  const requests = await db.select().from(travelRequests)
    .where(and(
      eq(travelRequests.user_id, user.id),
      inArray(travelRequests.status, ['APPROVED', 'FULFILLED', 'COMPLETED']),
    ));
  const advances = await db.select().from(cashAdvances)
    .where(and(
      eq(cashAdvances.user_id, user.id),
      eq(cashAdvances.status, 'DISBURSED'),
    ));
  const advancesByTravel = new Map<number, number>();
  for (const advance of advances) {
    advancesByTravel.set(
      advance.travel_request_id,
      (advancesByTravel.get(advance.travel_request_id) || 0)
        + Math.max(0, Number(advance.requested_amount) - Number(advance.returned_amount)),
    );
  }

  const reminders = requests.map((request) => ({
    travel_id: request.id,
    destination: request.destination,
    ...getTravelTracking(
      request.end_date,
      request.lpj_completed_at,
      advancesByTravel.get(request.id) || 0,
      now,
    ),
  })).filter((request) => request.reminder !== null);

  return c.json({
    cash_advance_running: Number(advanceSummary.running),
    cash_advance_returned: Number(advanceSummary.returned),
    travel_quota: {
      year: now.getFullYear(),
      used: Number(quotaSummary.used),
      limit: annualTravelQuota,
      remaining: Math.max(0, annualTravelQuota - Number(quotaSummary.used)),
    },
    reminders,
  });
});

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
