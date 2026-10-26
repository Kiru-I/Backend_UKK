import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, type UserRole } from '../db/schema';
import { verifyToken } from '../lib/auth';

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authorization = c.req.header('Authorization');

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'A valid bearer token is required.' }, 401);
  }

  const token = authorization.replace('Bearer ', '').trim();

  let payload: Awaited<ReturnType<typeof verifyToken>>['payload'];
  try {
    ({ payload } = await verifyToken(token));
  } catch {
    return c.json({ error: 'Unauthorized', message: 'The token is missing, expired, or invalid.' }, 401);
  }

  const userId = Number(payload.sub);
  if (!payload.email || !payload.role || !userId) {
    return c.json({ error: 'Unauthorized', message: 'Token payload is invalid.' }, 401);
  }

  const [account] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    status: users.status,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!account) {
    return c.json({ error: 'Unauthorized', message: 'The account for this token no longer exists.' }, 401);
  }
  if (account.status !== 'ACTIVE') {
    return c.json({ error: 'Forbidden', message: 'This account is not active.' }, 403);
  }

  c.set('user', {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
  });

  await next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'Authentication is required.' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Forbidden', message: 'You do not have permission to access this resource.' }, 403);
    }

    await next();
  };
}
