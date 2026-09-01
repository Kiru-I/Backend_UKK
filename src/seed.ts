import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';
import { hashPassword } from './lib/auth';

async function seed() {
  const passwordHash = await hashPassword('superadmin123');

  const existing = await db.select().from(users).where(eq(users.email, 'superadmin@travel.local')).limit(1);
  if (existing.length > 0) {
    console.log('Super admin already exists.');
    return;
  }

  await db.insert(users).values({
    name: 'Super Administrator',
    email: 'superadmin@travel.local',
    password_hash: passwordHash,
    role: 'Super Admin',
    department: 'IT',
  });

  console.log('Seeded Super Admin account.');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
