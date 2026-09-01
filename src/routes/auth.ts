import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { comparePassword, signToken } from '../lib/auth';

const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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

export default authRoutes;
