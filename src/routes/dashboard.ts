import { Hono } from 'hono';
import { db } from '../db';
import { cashAdvances, travelApprovals, travelRequests, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { getTravelTracking } from '../lib/travel-tracking';
import { getFinanceTransactions } from '../lib/finance-report';
import { getUserCompanyId } from '../lib/travel-access';

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

  if (user.role === 'Atasan') {
    const yearParam = c.req.query('year');
    if (yearParam !== undefined && !/^\d{4}$/.test(yearParam)) {
      return c.json({ error: 'Bad Request', message: 'year must be a four-digit year.' }, 400);
    }
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
    const [pendingStats, decisionHistory] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(travelRequests)
        .innerJoin(users, eq(travelRequests.user_id, users.id))
        .where(and(
          eq(users.supervisor_id, user.id),
          eq(users.role, 'Karyawan'),
          eq(travelRequests.status, 'PENDING'),
          gte(travelRequests.created_at, yearStart),
          lt(travelRequests.created_at, nextYearStart),
        )),
      db.select({
        status: travelApprovals.status,
        count: sql<number>`count(*)`,
      })
        .from(travelApprovals)
        .innerJoin(travelRequests, eq(travelApprovals.travel_request_id, travelRequests.id))
        .innerJoin(users, eq(travelRequests.user_id, users.id))
        .where(and(
          eq(users.supervisor_id, user.id),
          eq(users.role, 'Karyawan'),
          eq(travelApprovals.approver_id, user.id),
          gte(travelApprovals.created_at, yearStart),
          lt(travelApprovals.created_at, nextYearStart),
        ))
        .groupBy(travelApprovals.status),
    ]);
    const approved = decisionHistory.find((item) => item.status === 'APPROVED')?.count ?? 0;
    const rejected = decisionHistory.find((item) => item.status === 'REJECTED')?.count ?? 0;

    return c.json({
      year,
      pending: Number(pendingStats[0].count),
      approved: Number(approved),
      rejected: Number(rejected),
    });
  }

  const companyId = user.role === 'Admin Travel' ? await getUserCompanyId(user.id) : null;
  if (user.role === 'Admin Travel' && companyId === null) {
    return c.json({ error: 'Forbidden', message: 'The travel admin account is not associated with a company.' }, 403);
  }

  const travelStatConditions = [eq(users.role, 'Karyawan')];
  if (user.role === 'Admin Travel' && companyId !== null) {
    travelStatConditions.push(eq(users.company_id, companyId));
  }

  const travelStats = await db.select({
    status: travelRequests.status,
    count: sql<number>`count(*)`,
  })
    .from(travelRequests)
    .innerJoin(users, eq(travelRequests.user_id, users.id))
    .where(and(...travelStatConditions))
    .groupBy(travelRequests.status);
  const countByStatus = new Map(travelStats.map((item) => [item.status, Number(item.count)]));

  return c.json({
    upcoming: countByStatus.get('APPROVED') ?? 0,
    ongoing: countByStatus.get('FULFILLED') ?? 0,
    completed: countByStatus.get('COMPLETED') ?? 0,
  });
});

dashboardRoutes.get('/expenses', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin' && user.role !== 'Tim Keuangan') {
    return c.json({ error: 'Forbidden', message: 'You do not have permission to access expense reports.' }, 403);
  }

  const transactions = await getFinanceTransactions();
  const expenseByEmployee = new Map<number, {
    employee_name: string;
    role: string;
    department: string;
    total: number;
  }>();
  for (const transaction of transactions) {
    const existing = expenseByEmployee.get(transaction.applicant_id);
    expenseByEmployee.set(transaction.applicant_id, {
      employee_name: transaction.applicant_name,
      role: transaction.role,
      department: transaction.department,
      total: (existing?.total ?? 0) + Number(transaction.actual_expense),
    });
  }

  return c.json({
    expenses: [...expenseByEmployee.values()],
    transactions,
  });
});

export default dashboardRoutes;
