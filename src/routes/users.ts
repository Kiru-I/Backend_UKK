import { Hono } from 'hono';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { companies, userStatuses, users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { hashPassword } from '../lib/auth';

const usersRoutes = new Hono();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['Karyawan', 'Atasan', 'Admin Travel', 'Tim Keuangan', 'Super Admin']),
  department: z.string().min(2),
  company_id: z.coerce.number().int().positive().optional(),
  supervisor_id: z.coerce.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['Karyawan', 'Atasan', 'Admin Travel', 'Tim Keuangan', 'Super Admin']).optional(),
  department: z.string().min(2).optional(),
  status: z.enum(userStatuses).optional(),
  company_id: z.coerce.number().int().positive().nullable().optional(),
  supervisor_id: z.coerce.number().int().positive().nullable().optional(),
});

async function isValidSupervisor(supervisorId: number, companyId: number | undefined) {
  const [supervisor] = await db.select({
    id: users.id,
    role: users.role,
    company_id: users.company_id,
  })
    .from(users)
    .where(eq(users.id, supervisorId))
    .limit(1);

  return Boolean(
    supervisor
    && supervisor.role === 'Atasan'
    && companyId !== undefined
    && supervisor.company_id === companyId
  );
}

usersRoutes.use('*', authMiddleware);

usersRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only Super Admin can list users.' }, 403);
  }

  const allUsers = await db.select({
    id: users.id,
    company_id: users.company_id,
    supervisor_id: users.supervisor_id,
    name: users.name,
    email: users.email,
    nik: users.nik,
    role: users.role,
    department: users.department,
    status: users.status,
    created_at: users.created_at,
    updated_at: users.updated_at,
  }).from(users);
  return c.json({ users: allUsers });
});

usersRoutes.post('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only Super Admin can create users.' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const existingUser = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existingUser.length > 0) {
    return c.json({ error: 'Conflict', message: 'A user with this email already exists.' }, 409);
  }
  if (parsed.data.company_id !== undefined) {
    const [company] = await db.select({ id: companies.id }).from(companies)
      .where(eq(companies.id, parsed.data.company_id))
      .limit(1);
    if (!company) {
      return c.json({ error: 'Bad Request', message: 'Company was not found.' }, 400);
    }
  }
  if (parsed.data.role === 'Karyawan' && (parsed.data.company_id === undefined || parsed.data.supervisor_id === undefined)) {
    return c.json({ error: 'Bad Request', message: 'Employees must be assigned to an Atasan in their company.' }, 400);
  }
  if (
    parsed.data.supervisor_id !== undefined
    && !(await isValidSupervisor(parsed.data.supervisor_id, parsed.data.company_id))
  ) {
    return c.json({ error: 'Bad Request', message: 'supervisor_id must identify an Atasan in the same company.' }, 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [created] = await db.insert(users).values([
    {
      name: parsed.data.name,
      email: parsed.data.email,
      password_hash: passwordHash,
      role: parsed.data.role,
      department: parsed.data.department,
      status: 'ACTIVE',
      company_id: parsed.data.company_id ?? null,
      supervisor_id: parsed.data.supervisor_id ?? null,
    },
  ]);

  return c.json({
    message: 'User created successfully.',
    user: {
      id: created.insertId,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      department: parsed.data.department,
      status: 'ACTIVE',
      company_id: parsed.data.company_id ?? null,
      supervisor_id: parsed.data.supervisor_id ?? null,
    },
  }, 201);
});

usersRoutes.put('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only Super Admin can update users.' }, 403);
  }

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Bad Request', message: 'User id must be a number.' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const [record] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }
  if (parsed.data.email) {
    const [duplicate] = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);
    if (duplicate && duplicate.id !== record.id) {
      return c.json({ error: 'Conflict', message: 'A user with this email already exists.' }, 409);
    }
  }

  const companyId = parsed.data.company_id === undefined
    ? record.company_id
    : parsed.data.company_id === null
      ? null
      : parsed.data.company_id;
  const supervisorId = parsed.data.supervisor_id === undefined
    ? record.supervisor_id
    : parsed.data.supervisor_id === null
      ? null
      : parsed.data.supervisor_id;
  const role = parsed.data.role ?? record.role;
  if (companyId !== null && (!Number.isInteger(companyId) || companyId <= 0)) {
    return c.json({ error: 'Bad Request', message: 'company_id must be a positive integer or null.' }, 400);
  }
  if (supervisorId !== null && (!Number.isInteger(supervisorId) || supervisorId <= 0)) {
    return c.json({ error: 'Bad Request', message: 'supervisor_id must be a positive integer or null.' }, 400);
  }
  if (companyId !== null) {
    const [company] = await db.select({ id: companies.id }).from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    if (!company) {
      return c.json({ error: 'Bad Request', message: 'Company was not found.' }, 400);
    }
  }
  if (role === 'Karyawan' && (companyId === null || supervisorId === null)) {
    return c.json({ error: 'Bad Request', message: 'Employees must be assigned to an Atasan in their company.' }, 400);
  }
  if (
    supervisorId !== null
    && !(await isValidSupervisor(supervisorId, companyId ?? undefined))
  ) {
    return c.json({ error: 'Bad Request', message: 'supervisor_id must identify an Atasan in the same company.' }, 400);
  }

  const updates: Partial<typeof users.$inferInsert> = {
    name: parsed.data.name ?? record.name,
    email: parsed.data.email ?? record.email,
    role: role,
    department: parsed.data.department ?? record.department,
    status: parsed.data.status ?? record.status,
    company_id: companyId,
    supervisor_id: supervisorId,
  };

  if (parsed.data.password) {
    updates.password_hash = await hashPassword(parsed.data.password);
  }

  await db.update(users).set(updates).where(eq(users.id, id));

  return c.json({ message: 'User updated successfully.' });
});

usersRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only Super Admin can delete users.' }, 403);
  }

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'User id must be a positive number.' }, 400);
  }
  if (id === user.id) {
    return c.json({ error: 'Bad Request', message: 'You cannot delete your own account.' }, 400);
  }

  const [record] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }

  await db.delete(users).where(eq(users.id, id));

  return c.json({ message: 'User deleted successfully.' });
});

usersRoutes.post('/:id/reset-password', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only Super Admin can reset user passwords.' }, 403);
  }

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'User id must be a positive number.' }, 400);
  }

  const [record] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }

  const temporaryPassword = randomBytes(18).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, id));

  return c.json({
    message: 'Password reset successfully.',
    temporary_password: temporaryPassword,
  });
});

export default usersRoutes;
