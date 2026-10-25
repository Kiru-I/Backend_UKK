import { Hono } from 'hono';
import type { Context } from 'hono';
import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { companies, travelApprovals, travelFulfillments, travelRequests, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { getUserCompanyId } from '../lib/travel-access';

const fulfillmentRoutes = new Hono();

const fulfillmentSchema = z.object({
  transport_details: z.string().min(3),
  accommodation_details: z.string().min(3),
});

const queueQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['APPROVED', 'FULFILLED', 'COMPLETED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

fulfillmentRoutes.use('*', authMiddleware);

async function getQueue(c: Context, includePendingAlias = false) {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can view the fulfillment queue.' }, 403);
  }

  const parsed = queueQuerySchema.safeParse({
    search: c.req.query('search'),
    status: c.req.query('status'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const { search, status, page, limit } = parsed.data;
  const conditions = [eq(travelRequests.status, status || 'APPROVED')];

  if (user.role === 'Admin Travel') {
    const companyId = await getUserCompanyId(user.id);
    if (companyId === null) {
      return c.json({ error: 'Forbidden', message: 'The travel admin account is not associated with a company.' }, 403);
    }
    conditions.push(eq(users.company_id, companyId));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(
      like(users.name, pattern),
      like(users.email, pattern),
      like(users.department, pattern),
      like(travelRequests.destination, pattern),
      like(travelRequests.purpose, pattern),
      like(companies.name, pattern),
    )!);
  }

  const where = and(...conditions);
  const [totalResult, requests] = await Promise.all([
    db.select({ total: sql<number>`count(*)` })
      .from(travelRequests)
      .innerJoin(users, eq(travelRequests.user_id, users.id))
      .innerJoin(companies, eq(users.company_id, companies.id))
      .where(where),
    db.select({
      id: travelRequests.id,
      user_id: travelRequests.user_id,
      applicant_name: users.name,
      applicant_email: users.email,
      department: users.department,
      company_id: companies.id,
      company_name: companies.name,
      destination: travelRequests.destination,
      start_date: travelRequests.start_date,
      end_date: travelRequests.end_date,
      estimated_cost: travelRequests.estimated_cost,
      purpose: travelRequests.purpose,
      transportation_mode: travelRequests.transportation_mode,
      document_url: travelRequests.document_url,
      status: travelRequests.status,
      created_at: travelRequests.created_at,
      updated_at: travelRequests.updated_at,
    })
      .from(travelRequests)
      .innerJoin(users, eq(travelRequests.user_id, users.id))
      .innerJoin(companies, eq(users.company_id, companies.id))
      .where(where)
      .orderBy(desc(travelRequests.created_at))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  const requestIds = requests.map((request) => request.id);
  const [approvals, fulfillments] = requestIds.length
    ? await Promise.all([
      db.select({
        travel_request_id: travelApprovals.travel_request_id,
        status: travelApprovals.status,
        notes: travelApprovals.notes,
        processed_at: travelApprovals.created_at,
        approver_name: users.name,
      })
        .from(travelApprovals)
        .innerJoin(users, eq(travelApprovals.approver_id, users.id))
        .where(inArray(travelApprovals.travel_request_id, requestIds))
        .orderBy(desc(travelApprovals.created_at)),
      db.select({
        id: travelFulfillments.id,
        travel_request_id: travelFulfillments.travel_request_id,
        transport_details: travelFulfillments.transport_details,
        accommodation_details: travelFulfillments.accommodation_details,
        fulfilled_by: users.name,
        created_at: travelFulfillments.created_at,
      })
        .from(travelFulfillments)
        .innerJoin(users, eq(travelFulfillments.admin_id, users.id))
        .where(inArray(travelFulfillments.travel_request_id, requestIds))
        .orderBy(desc(travelFulfillments.created_at)),
    ])
    : [[], []];

  const approvalByTravelId = new Map<number, (typeof approvals)[number]>();
  for (const approval of approvals) {
    if (!approvalByTravelId.has(approval.travel_request_id)) {
      approvalByTravelId.set(approval.travel_request_id, approval);
    }
  }
  const fulfillmentsByTravelId = new Map<number, typeof fulfillments>();
  for (const fulfillment of fulfillments) {
    const existing = fulfillmentsByTravelId.get(fulfillment.travel_request_id) || [];
    existing.push(fulfillment);
    fulfillmentsByTravelId.set(fulfillment.travel_request_id, existing);
  }

  const enrichedRequests = requests.map((request) => ({
    ...request,
    approval: approvalByTravelId.get(request.id) ?? null,
    fulfillments: fulfillmentsByTravelId.get(request.id) ?? [],
  }));

  return c.json({
    ...(includePendingAlias ? { pending: enrichedRequests } : {}),
    requests: enrichedRequests,
    pagination: {
      page,
      limit,
      total: Number(totalResult[0].total),
      total_pages: Math.ceil(Number(totalResult[0].total) / limit),
    },
  });
}

fulfillmentRoutes.get('/pending', (c) => getQueue(c, true));
fulfillmentRoutes.get('/queue', (c) => getQueue(c));

fulfillmentRoutes.get('/:travelId', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can view fulfillment details.' }, 403);
  }

  const travelId = Number(c.req.param('travelId'));
  if (!Number.isInteger(travelId) || travelId <= 0) {
    return c.json({ error: 'Bad Request', message: 'Travel request id must be a positive number.' }, 400);
  }

  const conditions = [eq(travelRequests.id, travelId)];
  if (user.role === 'Admin Travel') {
    const companyId = await getUserCompanyId(user.id);
    if (companyId === null) {
      return c.json({ error: 'Forbidden', message: 'The travel admin account is not associated with a company.' }, 403);
    }
    conditions.push(eq(users.company_id, companyId));
  }

  const [request] = await db.select({
    id: travelRequests.id,
    user_id: travelRequests.user_id,
    applicant_name: users.name,
    company_id: companies.id,
    company_name: companies.name,
    destination: travelRequests.destination,
    status: travelRequests.status,
  })
    .from(travelRequests)
    .innerJoin(users, eq(travelRequests.user_id, users.id))
    .innerJoin(companies, eq(users.company_id, companies.id))
    .where(and(...conditions))
    .limit(1);

  if (!request) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }

  const fulfillments = await db.select({
    id: travelFulfillments.id,
    transport_details: travelFulfillments.transport_details,
    accommodation_details: travelFulfillments.accommodation_details,
    admin_id: travelFulfillments.admin_id,
    admin_name: users.name,
    created_at: travelFulfillments.created_at,
  })
    .from(travelFulfillments)
    .innerJoin(users, eq(travelFulfillments.admin_id, users.id))
    .where(eq(travelFulfillments.travel_request_id, travelId))
    .orderBy(desc(travelFulfillments.created_at));

  return c.json({ request, fulfillments });
});

fulfillmentRoutes.post('/:travelId', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can fulfill trips.' }, 403);
  }

  const travelId = Number(c.req.param('travelId'));
  if (!Number.isInteger(travelId) || travelId <= 0) {
    return c.json({ error: 'Bad Request', message: 'Travel request id must be a positive number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = fulfillmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const conditions = [eq(travelRequests.id, travelId)];
  if (user.role === 'Admin Travel') {
    const companyId = await getUserCompanyId(user.id);
    if (companyId === null) {
      return c.json({ error: 'Forbidden', message: 'The travel admin account is not associated with a company.' }, 403);
    }
    conditions.push(eq(users.company_id, companyId));
  }

  const [request] = await db.select({
    id: travelRequests.id,
    status: travelRequests.status,
  })
    .from(travelRequests)
    .innerJoin(users, eq(travelRequests.user_id, users.id))
    .where(and(...conditions))
    .limit(1);

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
