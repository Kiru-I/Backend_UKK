import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '../db/schema';

export const JWT_SECRET = process.env.JWT_SECRET || 'travel-management-secret';

export type AuthTokenPayload = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

export async function signToken(user: AuthTokenPayload) {
  const secret = new TextEncoder().encode(JWT_SECRET);

  return new SignJWT({
    sub: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return jwtVerify(token, secret);
}
