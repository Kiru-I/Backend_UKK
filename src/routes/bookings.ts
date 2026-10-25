import { Hono } from 'hono';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { companies, travelBookings, travelRequests, users, transportationModes } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { getUserCompanyId } from '../lib/travel-access';

const bookingRoutes = new Hono();

const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Expected a valid date in YYYY-MM-DD format.');
const bookingSchema = z.object({
  booking_code: z.string().trim().min(1).max(100),
  transportation_mode: z.enum(transportationModes),
  operator: z.string().trim().max(255).optional().nullable(),
  departure_at: z.string().datetime({ offset: true }).optional().nullable(),
  arrival_at: z.string().datetime({ offset: true }).optional().nullable(),
  hotel_name: z.string().trim().max(255).optional().nullable(),
  room_type: z.string().trim().max(255).optional().nullable(),
  check_in_date: dateSchema.optional().nullable(),
  check_out_date: dateSchema.optional().nullable(),
}).superRefine((booking, context) => {
  if (booking.departure_at && booking.arrival_at
    && new Date(booking.departure_at) > new Date(booking.arrival_at)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['arrival_at'],
      message: 'Arrival must not be earlier than departure.',
    });
  }
  if (booking.check_in_date && booking.check_out_date
    && booking.check_in_date > booking.check_out_date) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['check_out_date'],
      message: 'Check-out must not be earlier than check-in.',
    });
  }
  if ((booking.check_in_date && !booking.check_out_date)
    || (!booking.check_in_date && booking.check_out_date)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [booking.check_in_date ? 'check_out_date' : 'check_in_date'],
      message: 'Check-in and check-out dates must be provided together.',
    });
  }
});

bookingRoutes.use('*', authMiddleware);

async function companyCondition(userId: number, role: string) {
  if (role === 'Super Admin') return undefined;
  const companyId = await getUserCompanyId(userId);
  return companyId;
}

bookingRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can view bookings.' }, 403);
  }

  const page = Number(c.req.query('page') || 1);
  const limit = Number(c.req.query('limit') || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return c.json({ error: 'Bad Request', message: 'page must be positive and limit must be between 1 and 100.' }, 400);
  }

  const conditions: SQL[] = [];
  if (user.role === 'Admin Travel') {
    const companyId = await companyCondition(user.id, user.role);
    if (companyId === null) {
      return c.json({ error: 'Forbidden', message: 'The travel admin account is not associated with a company.' }, 403);
    }
    conditions.push(eq(users.company_id, companyId));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [totalResult, bookings] = await Promise.all([
    db.select({ total: sql<number>`count(*)` })
      .from(travelBookings)
      .innerJoin(travelRequests, eq(travelBookings.travel_request_id, travelRequests.id))
      .innerJoin(users, eq(travelBookings.user_id, users.id))
      .innerJoin(companies, eq(users.company_id, companies.id))
      .where(where),
    db.select({
      id: travelBookings.id,
      travel_request_id: travelBookings.travel_request_id,
      user_id: travelBookings.user_id,
      booking_code: travelBookings.booking_code,
      transportation_mode: travelBookings.transportation_mode,
      operator: travelBookings.operator,
      departure_at: travelBookings.departure_at,
      arrival_at: travelBookings.arrival_at,
      hotel_name: travelBookings.hotel_name,
      room_type: travelBookings.room_type,
      check_in_date: travelBookings.check_in_date,
      check_out_date: travelBookings.check_out_date,
      created_at: travelBookings.created_at,
      applicant_name: users.name,
      department: users.department,
      company_id: companies.id,
      company_name: companies.name,
      destination: travelRequests.destination,
      travel_status: travelRequests.status,
      travel_start_date: travelRequests.start_date,
      travel_end_date: travelRequests.end_date,
    })
      .from(travelBookings)
      .innerJoin(travelRequests, eq(travelBookings.travel_request_id, travelRequests.id))
      .innerJoin(users, eq(travelBookings.user_id, users.id))
      .innerJoin(companies, eq(users.company_id, companies.id))
      .where(where)
      .orderBy(desc(travelBookings.created_at))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);

  return c.json({
    bookings,
    pagination: {
      page,
      limit,
      total: Number(totalResult[0].total),
      total_pages: Math.ceil(Number(totalResult[0].total) / limit),
    },
  });
});

bookingRoutes.get('/:travelId', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can view bookings.' }, 403);
  }

  const travelId = Number(c.req.param('travelId'));
  if (!Number.isInteger(travelId) || travelId <= 0) {
    return c.json({ error: 'Bad Request', message: 'Travel request id must be a positive number.' }, 400);
  }

  const conditions = [eq(travelBookings.travel_request_id, travelId)];
  if (user.role === 'Admin Travel') {
    const companyId = await companyCondition(user.id, user.role);
    if (companyId === null) {
      return c.json({ error: 'Forbidden', message: 'The travel admin account is not associated with a company.' }, 403);
    }
    conditions.push(eq(users.company_id, companyId));
  }

  const [booking] = await db.select({
    id: travelBookings.id,
    travel_request_id: travelBookings.travel_request_id,
    user_id: travelBookings.user_id,
    booking_code: travelBookings.booking_code,
    transportation_mode: travelBookings.transportation_mode,
    operator: travelBookings.operator,
    departure_at: travelBookings.departure_at,
    arrival_at: travelBookings.arrival_at,
    hotel_name: travelBookings.hotel_name,
    room_type: travelBookings.room_type,
    check_in_date: travelBookings.check_in_date,
    check_out_date: travelBookings.check_out_date,
    created_at: travelBookings.created_at,
    applicant_name: users.name,
    company_name: companies.name,
    destination: travelRequests.destination,
    travel_status: travelRequests.status,
  })
    .from(travelBookings)
    .innerJoin(travelRequests, eq(travelBookings.travel_request_id, travelRequests.id))
    .innerJoin(users, eq(travelBookings.user_id, users.id))
    .innerJoin(companies, eq(users.company_id, companies.id))
    .where(and(...conditions))
    .limit(1);

  if (!booking) {
    return c.json({ error: 'Not Found', message: 'Booking was not found.' }, 404);
  }
  return c.json({ booking });
});

bookingRoutes.post('/:travelId', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Admin Travel' && user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only travel admin can create bookings.' }, 403);
  }

  const travelId = Number(c.req.param('travelId'));
  if (!Number.isInteger(travelId) || travelId <= 0) {
    return c.json({ error: 'Bad Request', message: 'Travel request id must be a positive number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const conditions = [eq(travelRequests.id, travelId)];
  if (user.role === 'Admin Travel') {
    const companyId = await companyCondition(user.id, user.role);
    if (companyId === null) {
      return c.json({ error: 'Forbidden', message: 'The travel admin account is not associated with a company.' }, 403);
    }
    conditions.push(eq(users.company_id, companyId));
  }

  const [request] = await db.select({
    id: travelRequests.id,
    user_id: travelRequests.user_id,
    status: travelRequests.status,
  })
    .from(travelRequests)
    .innerJoin(users, eq(travelRequests.user_id, users.id))
    .where(and(...conditions))
    .limit(1);

  if (!request) {
    return c.json({ error: 'Not Found', message: 'Travel request was not found.' }, 404);
  }
  if (request.status !== 'APPROVED' && request.status !== 'FULFILLED') {
    return c.json({ error: 'Bad Request', message: 'Bookings can only be recorded for approved or fulfilled trips.' }, 400);
  }

  const [existing] = await db.select({ id: travelBookings.id })
    .from(travelBookings)
    .where(eq(travelBookings.travel_request_id, request.id))
    .limit(1);
  if (existing) {
    return c.json({ error: 'Conflict', message: 'A booking has already been recorded for this travel request.' }, 409);
  }
  const [duplicateCode] = await db.select({ id: travelBookings.id })
    .from(travelBookings)
    .where(eq(travelBookings.booking_code, parsed.data.booking_code))
    .limit(1);
  if (duplicateCode) {
    return c.json({ error: 'Conflict', message: 'The booking code is already in use.' }, 409);
  }

  const [created] = await db.insert(travelBookings).values({
    travel_request_id: request.id,
    user_id: request.user_id,
    booking_code: parsed.data.booking_code,
    transportation_mode: parsed.data.transportation_mode,
    operator: parsed.data.operator || null,
    departure_at: parsed.data.departure_at ? new Date(parsed.data.departure_at) : null,
    arrival_at: parsed.data.arrival_at ? new Date(parsed.data.arrival_at) : null,
    hotel_name: parsed.data.hotel_name || null,
    room_type: parsed.data.room_type || null,
    check_in_date: parsed.data.check_in_date ? new Date(parsed.data.check_in_date) : null,
    check_out_date: parsed.data.check_out_date ? new Date(parsed.data.check_out_date) : null,
  });

  return c.json({
    message: 'Booking recorded successfully.',
    booking: {
      id: created.insertId,
      travel_request_id: request.id,
      user_id: request.user_id,
      ...parsed.data,
    },
  }, 201);
});

export default bookingRoutes;
