import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  cashAdvances,
  financeSettings,
  reimbursements,
  travelRequests,
  users,
} from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { getFinanceTransactions } from '../lib/finance-report';

const financeRoutes = new Hono();
const financeRoles = ['Tim Keuangan', 'Super Admin'] as const;
const defaultPaymentMethods = [
  { code: 'BANK_TRANSFER', label: 'Transfer Bank', description: 'Pembayaran melalui transfer bank.' },
  { code: 'CASH', label: 'Tunai', description: 'Pembayaran tunai dengan bukti transaksi.' },
];

const settingsSchema = z.object({
  annual_budget: z.coerce.number().min(0).max(999999999999.99),
  payment_methods: z.array(z.object({
    code: z.string().min(2).max(100),
    label: z.string().min(2).max(100),
    description: z.string().max(500),
  })).min(1).max(20),
});

const paymentSchema = z.object({
  payment_reference: z.string().trim().min(1).max(100),
  payment_method: z.string().trim().min(2).max(100),
  payment_date: z.string().datetime().optional(),
});

financeRoutes.use('*', authMiddleware);

financeRoutes.use('*', async (c, next) => {
  if (!financeRoles.includes(c.get('user').role as (typeof financeRoles)[number])) {
    return c.json({ error: 'Forbidden', message: 'Only Finance and Super Admin can access finance data.' }, 403);
  }
  await next();
});

financeRoutes.get('/transactions', async (c) => {
  const yearParam = c.req.query('year');
  if (yearParam !== undefined && !/^\d{4}$/.test(yearParam)) {
    return c.json({ error: 'Bad Request', message: 'year must be a four-digit year.' }, 400);
  }
  const transactions = await getFinanceTransactions();
  const filtered = yearParam
    ? transactions.filter((item) =>
      new Date(item.requested_at).getFullYear() === Number(yearParam)
      || (item.payment_date !== null && new Date(item.payment_date).getFullYear() === Number(yearParam))
    )
    : transactions;
  const actualExpense = filtered
    .filter((item) =>
      item.payment_status === 'PAID'
      || item.payment_status === 'DISBURSED'
    )
    .filter((item) =>
      !yearParam
      || (item.payment_date !== null && new Date(item.payment_date).getFullYear() === Number(yearParam))
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const waitingPayment = filtered
    .filter((item) =>
      item.transaction_type === 'CASH_ADVANCE'
      && item.payment_status === 'WAITING_PAYMENT'
      && (!yearParam || new Date(item.requested_at).getFullYear() === Number(yearParam))
    )
    .reduce((sum, item) => sum + Number(item.amount), 0)
    + filtered
      .filter((item) =>
        item.transaction_type === 'REIMBURSEMENT'
        && item.payment_status === 'WAITING_PAYMENT'
        && (!yearParam || new Date(item.requested_at).getFullYear() === Number(yearParam))
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);

  return c.json({
    transactions: filtered,
    summary: {
      year: yearParam ? Number(yearParam) : null,
      actual_expense: actualExpense.toFixed(2),
      waiting_payment: waitingPayment.toFixed(2),
      count: filtered.length,
    },
  });
});

financeRoutes.get('/payments/queue', async (c) => {
  const [reimbursementQueue, advanceQueue] = await Promise.all([
    db.select({
      id: reimbursements.id,
      applicant_name: users.name,
      role: users.role,
      department: users.department,
      destination: travelRequests.destination,
      amount: reimbursements.total_amount,
      requested_at: reimbursements.created_at,
      status: reimbursements.status,
    })
      .from(reimbursements)
      .innerJoin(users, eq(reimbursements.user_id, users.id))
      .innerJoin(travelRequests, eq(reimbursements.travel_request_id, travelRequests.id))
      .where(eq(reimbursements.status, 'VERIFIED')),
    db.select({
      id: cashAdvances.id,
      applicant_name: users.name,
      role: users.role,
      department: users.department,
      destination: travelRequests.destination,
      amount: cashAdvances.requested_amount,
      requested_at: cashAdvances.created_at,
      status: cashAdvances.status,
    })
      .from(cashAdvances)
      .innerJoin(users, eq(cashAdvances.user_id, users.id))
      .innerJoin(travelRequests, eq(cashAdvances.travel_request_id, travelRequests.id))
      .where(and(
        eq(cashAdvances.status, 'WAITING_PAYMENT'),
        eq(travelRequests.status, 'FULFILLED'),
      )),
  ]);

  const queue = [
    ...reimbursementQueue.map((item) => ({
      ...item,
      transaction_id: `REIMBURSEMENT-${item.id}`,
      transaction_type: 'REIMBURSEMENT' as const,
    })),
    ...advanceQueue.map((item) => ({
      ...item,
      transaction_id: `CASH_ADVANCE-${item.id}`,
      transaction_type: 'CASH_ADVANCE' as const,
    })),
  ].sort((left, right) =>
    new Date(left.requested_at).getTime() - new Date(right.requested_at).getTime()
  );

  return c.json({ queue });
});

financeRoutes.post('/payments/:type/:id/process', async (c) => {
  const type = c.req.param('type');
  if (type !== 'reimbursement' && type !== 'cash-advance') {
    return c.json({ error: 'Bad Request', message: 'type must be reimbursement or cash-advance.' }, 400);
  }
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'Transaction id must be a positive number.' }, 400);
  }
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [settings] = await db.select().from(financeSettings).limit(1);
  const methods = settings
    ? JSON.parse(settings.payment_methods) as Array<{ code: string; label: string; description: string }>
    : defaultPaymentMethods;
  if (!methods.some((method) => method.code === parsed.data.payment_method)) {
    return c.json({ error: 'Bad Request', message: 'payment_method is not configured in Finance settings.' }, 400);
  }

  const paymentDate = parsed.data.payment_date ? new Date(parsed.data.payment_date) : new Date();
  const processed = await db.transaction(async (tx) => {
    if (type === 'reimbursement') {
      const [updated] = await tx.update(reimbursements)
        .set({
          status: 'PAID',
          payment_date: paymentDate,
          payment_reference: parsed.data.payment_reference,
          payment_method: parsed.data.payment_method,
          processed_by: c.get('user').id,
        })
        .where(and(eq(reimbursements.id, id), eq(reimbursements.status, 'VERIFIED')));
      return updated.affectedRows === 1;
    }

    const [advance] = await tx.select().from(cashAdvances)
      .where(and(eq(cashAdvances.id, id), eq(cashAdvances.status, 'WAITING_PAYMENT')))
      .limit(1);
    if (!advance) return false;

    const [travelRequest] = await tx.select().from(travelRequests)
      .where(eq(travelRequests.id, advance.travel_request_id))
      .limit(1);
    if (!travelRequest || travelRequest.status !== 'FULFILLED') return false;

    const [updated] = await tx.update(cashAdvances)
      .set({
        status: 'DISBURSED',
        payment_date: paymentDate,
        payment_reference: parsed.data.payment_reference,
        payment_method: parsed.data.payment_method,
        processed_by: c.get('user').id,
      })
      .where(and(eq(cashAdvances.id, id), eq(cashAdvances.status, 'WAITING_PAYMENT')));
    if (updated.affectedRows !== 1) return false;

    const pendingAdvances = await tx.select({ id: cashAdvances.id }).from(cashAdvances)
      .where(and(
        eq(cashAdvances.travel_request_id, travelRequest.id),
        eq(cashAdvances.status, 'WAITING_PAYMENT'),
      ));
    if (
      pendingAdvances.length === 0
      && travelRequest.lpj_completed_at
      && new Date(travelRequest.end_date) <= new Date()
    ) {
      await tx.update(travelRequests)
        .set({ status: 'COMPLETED', updated_at: new Date() })
        .where(and(eq(travelRequests.id, travelRequest.id), eq(travelRequests.status, 'FULFILLED')));
    }
    return true;
  });

  if (!processed) {
    return c.json({
      error: 'Conflict',
      message: type === 'reimbursement'
        ? 'Only VERIFIED reimbursements can be paid.'
        : 'Only WAITING_PAYMENT advances for fulfilled trips can be disbursed.',
    }, 409);
  }

  return c.json({
    message: type === 'reimbursement' ? 'Reimbursement paid successfully.' : 'Cash advance disbursed successfully.',
    transaction: {
      id,
      transaction_type: type === 'reimbursement' ? 'REIMBURSEMENT' : 'CASH_ADVANCE',
      status: type === 'reimbursement' ? 'PAID' : 'DISBURSED',
      payment_date: paymentDate,
      payment_reference: parsed.data.payment_reference,
      payment_method: parsed.data.payment_method,
      processed_by: c.get('user').id,
    },
  });
});

financeRoutes.get('/payments/history', async (c) => {
  const [paidReimbursements, disbursedAdvances] = await Promise.all([
    db.select({
      id: reimbursements.id,
      applicant_name: users.name,
      role: users.role,
      department: users.department,
      destination: travelRequests.destination,
      amount: reimbursements.total_amount,
      payment_date: reimbursements.payment_date,
      payment_reference: reimbursements.payment_reference,
      payment_method: reimbursements.payment_method,
      processed_by: reimbursements.processed_by,
    })
      .from(reimbursements)
      .innerJoin(users, eq(reimbursements.user_id, users.id))
      .innerJoin(travelRequests, eq(reimbursements.travel_request_id, travelRequests.id))
      .where(eq(reimbursements.status, 'PAID')),
    db.select({
      id: cashAdvances.id,
      applicant_name: users.name,
      role: users.role,
      department: users.department,
      destination: travelRequests.destination,
      amount: cashAdvances.requested_amount,
      payment_date: cashAdvances.payment_date,
      payment_reference: cashAdvances.payment_reference,
      payment_method: cashAdvances.payment_method,
      processed_by: cashAdvances.processed_by,
    })
      .from(cashAdvances)
      .innerJoin(users, eq(cashAdvances.user_id, users.id))
      .innerJoin(travelRequests, eq(cashAdvances.travel_request_id, travelRequests.id))
      .where(eq(cashAdvances.status, 'DISBURSED')),
  ]);

  const processedByIds = [...new Set([
    ...paidReimbursements.map((item) => item.processed_by),
    ...disbursedAdvances.map((item) => item.processed_by),
  ].filter((id): id is number => id !== null))];
  const processors = processedByIds.length
    ? await db.select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(inArray(users.id, processedByIds))
    : [];
  const processorById = new Map(processors.map((processor) => [processor.id, processor]));

  const history = [
    ...paidReimbursements.map((item) => ({
      ...item,
      transaction_id: `REIMBURSEMENT-${item.id}`,
      transaction_type: 'REIMBURSEMENT' as const,
      status: 'PAID' as const,
      processor: item.processed_by === null ? null : processorById.get(item.processed_by) ?? null,
    })),
    ...disbursedAdvances.map((item) => ({
      ...item,
      transaction_id: `CASH_ADVANCE-${item.id}`,
      transaction_type: 'CASH_ADVANCE' as const,
      status: 'DISBURSED' as const,
      processor: item.processed_by === null ? null : processorById.get(item.processed_by) ?? null,
    })),
  ].sort((left, right) =>
    new Date(right.payment_date ?? 0).getTime() - new Date(left.payment_date ?? 0).getTime()
  );

  return c.json({ history });
});

financeRoutes.get('/settings', async (c) => {
  const [settings] = await db.select().from(financeSettings).limit(1);
  if (!settings) {
    return c.json({ settings: { annual_budget: '0.00', payment_methods: defaultPaymentMethods } });
  }

  return c.json({
    settings: {
      annual_budget: settings.annual_budget,
      payment_methods: JSON.parse(settings.payment_methods),
      updated_by: settings.updated_by,
      updated_at: settings.updated_at,
    },
  });
});

financeRoutes.put('/settings', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }
  const uniqueCodes = new Set(parsed.data.payment_methods.map((method) => method.code));
  if (uniqueCodes.size !== parsed.data.payment_methods.length) {
    return c.json({ error: 'Validation Error', message: 'Payment method codes must be unique.' }, 400);
  }

  const paymentMethods = JSON.stringify(parsed.data.payment_methods);
  await db.insert(financeSettings)
    .values({
      id: 1,
      annual_budget: parsed.data.annual_budget.toFixed(2),
      payment_methods: paymentMethods,
      updated_by: c.get('user').id,
    })
    .onDuplicateKeyUpdate({
      set: {
        annual_budget: parsed.data.annual_budget.toFixed(2),
        payment_methods: paymentMethods,
        updated_by: c.get('user').id,
        updated_at: new Date(),
      },
    });

  return c.json({
    message: 'Finance settings saved successfully.',
    settings: {
      annual_budget: parsed.data.annual_budget.toFixed(2),
      payment_methods: parsed.data.payment_methods,
      updated_by: c.get('user').id,
    },
  });
});

export default financeRoutes;
