import type { Context, Next } from 'hono';
import type { UserRole } from '../db/schema';
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

  try {
    const { payload } = await verifyToken(token);
    const userId = Number(payload.sub);

    if (!payload.email || !payload.role || !userId) {
      return c.json({ error: 'Unauthorized', message: 'Token payload is invalid.' }, 401);
    }

    c.set('user', {
      id: userId,
      email: String(payload.email),
      name: String(payload.name || 'User'),
      role: payload.role as UserRole,
    });

    await next();
  } catch {
    return c.json({ error: 'Unauthorized', message: 'The token is missing, expired, or invalid.' }, 401);
  }
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
