import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { comparePassword, hashPassword, signToken } from '../lib/auth';

const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const changePasswordSchema = z.object({
  password_saat_ini: z.string().min(6),
  password_baru: z.string().min(6),
  konfirmasi_password_baru: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  department: z.string().min(2),
  role: z.enum(['Karyawan', 'Atasan', 'Admin Travel', 'Tim Keuangan', 'Super Admin']).optional().default('Karyawan'),
});

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const { name, email, password, department, role } = parsed.data;
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existingUser) {
    return c.json({ error: 'Conflict', message: 'A user with this email already exists.' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db.insert(users).values([
    {
      name,
      email,
      password_hash: passwordHash,
      role,
      department,
    },
  ]);

  const userId = Number(created.insertId);
  const token = await signToken({
    id: userId,
    email,
    name,
    role,
  });

  return c.json({
    token,
    user: {
      id: userId,
      name,
      email,
      role,
      department,
    },
  }, 201);
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password.' }, 401);
  }

  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password.' }, 401);
  }

  const token = await signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  return c.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
  });
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');

  const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }

  return c.json({
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    department: record.department,
  });
});

authRoutes.post('/change-password', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Bad Request', message: 'Request body is required.' }, 400);
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  if (parsed.data.password_baru !== parsed.data.konfirmasi_password_baru) {
    return c.json({ error: 'Bad Request', message: 'New password confirmation does not match.' }, 400);
  }

  if (parsed.data.password_saat_ini === parsed.data.password_baru) {
    return c.json({ error: 'Bad Request', message: 'New password must be different from the current password.' }, 400);
  }

  const user = c.get('user');
  const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!record) {
    return c.json({ error: 'Not Found', message: 'User was not found.' }, 404);
  }

  const isValid = await comparePassword(parsed.data.password_saat_ini, record.password_hash);
  if (!isValid) {
    return c.json({ error: 'Bad Request', message: 'Current password is incorrect.' }, 400);
  }

  const passwordHash = await hashPassword(parsed.data.password_baru);
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, user.id));

  return c.json({ message: 'Password changed successfully.' });
});

export default authRoutes;
