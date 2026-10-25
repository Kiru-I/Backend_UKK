import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

export async function getUserCompanyId(userId: number) {
  const [account] = await db.select({ company_id: users.company_id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return account?.company_id ?? null;
}
