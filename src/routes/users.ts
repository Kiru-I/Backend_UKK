import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { hashPassword } from '../lib/auth';

const usersRoutes = new Hono();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['Karyawan', 'Atasan', 'Admin Travel', 'Tim Keuangan', 'Super Admin']),
  department: z.string().min(2),
});

usersRoutes.use('*', authMiddleware);

usersRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (user.role !== 'Super Admin') {
    return c.json({ error: 'Forbidden', message: 'Only Super Admin can list users.' }, 403);
  }

  const allUsers = await db.select().from(users);
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

  const passwordHash = await hashPassword(parsed.data.password);
  const [created] = await db.insert(users).values([
    {
      name: parsed.data.name,
      email: parsed.data.email,
      password_hash: passwordHash,
      role: parsed.data.role,
      department: parsed.data.department,
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

  const [record] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }

  const updates: Partial<typeof users.$inferInsert> = {
    name: typeof body.name === 'string' ? body.name : record.name,
    email: typeof body.email === 'string' ? body.email : record.email,
    role: typeof body.role === 'string' ? (body.role as typeof record.role) : record.role,
    department: typeof body.department === 'string' ? body.department : record.department,
  };

  if (typeof body.password === 'string' && body.password.length >= 6) {
    updates.password_hash = await hashPassword(body.password);
  }

  await db.update(users).set(updates).where(eq(users.id, id));

  return c.json({ message: 'User updated successfully.' });
});

export default usersRoutes;
