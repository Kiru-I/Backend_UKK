import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { permissions, rolePermissions, roles, travelPolicies } from '../db/schema';
import { authMiddleware, requireRole } from '../middleware/auth';

const settingsRoutes = new Hono();

const travelPolicySchema = z.object({
  max_hotel_per_night: z.number().int().nonnegative(),
  allowed_hotel_class: z.string().trim().min(1).max(100),
  flight_class: z.string().trim().min(1).max(100),
  max_local_transport_per_day: z.number().int().nonnegative(),
  daily_meal_allowance: z.number().int().nonnegative(),
  max_cash_advance_percent: z.number().int().min(0).max(100),
  report_deadline_days: z.number().int().positive(),
}).strict();

const rolePermissionsSchema = z.object({
  roles: z.array(z.object({
    id: z.number().int().positive(),
    permission_ids: z.array(z.number().int().positive()).refine(
      (permissionIds) => new Set(permissionIds).size === permissionIds.length,
      'Permission IDs must not contain duplicates.',
    ),
  })).min(1).refine(
    (roleUpdates) => new Set(roleUpdates.map(({ id }) => id)).size === roleUpdates.length,
    'Role IDs must not contain duplicates.',
  ),
}).strict();

settingsRoutes.use('*', authMiddleware);
settingsRoutes.use('*', requireRole(['Super Admin']));

settingsRoutes.get('/travel-policy', async (c) => {
  const [policy] = await db.select({
    max_hotel_per_night: travelPolicies.max_hotel_per_night,
    allowed_hotel_class: travelPolicies.allowed_hotel_class,
    flight_class: travelPolicies.flight_class,
    max_local_transport_per_day: travelPolicies.max_local_transport_per_day,
    daily_meal_allowance: travelPolicies.daily_meal_allowance,
    max_cash_advance_percent: travelPolicies.max_cash_advance_percent,
    report_deadline_days: travelPolicies.report_deadline_days,
  }).from(travelPolicies).where(eq(travelPolicies.id, 1)).limit(1);

  if (!policy) {
    return c.json({ error: 'Internal Server Error', message: 'Travel policy settings have not been initialized.' }, 500);
  }

  return c.json({ data: policy });
});

settingsRoutes.put('/travel-policy', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = travelPolicySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  await db.update(travelPolicies).set(parsed.data).where(eq(travelPolicies.id, 1));
  return c.json({ data: parsed.data });
});

settingsRoutes.get('/role-permissions', async (c) => {
  const [roleRows, permissionRows, assignments] = await Promise.all([
    db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.id)),
    db.select({ id: permissions.id, name: permissions.name }).from(permissions).orderBy(asc(permissions.id)),
    db.select({
      role_id: rolePermissions.role_id,
      permission_id: rolePermissions.permission_id,
    }).from(rolePermissions),
  ]);

  return c.json({
    data: {
      roles: roleRows.map((role) => ({
        ...role,
        permission_ids: assignments
          .filter((assignment) => assignment.role_id === role.id)
          .map((assignment) => assignment.permission_id)
          .sort((left, right) => left - right),
      })),
      permissions: permissionRows,
    },
  });
});

settingsRoutes.put('/role-permissions', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = rolePermissionsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation Error', details: parsed.error.flatten() }, 400);
  }

  const knownRoleIds = new Set([1, 2, 3, 4, 5]);
  const knownPermissionIds = new Set([1, 2, 3, 4, 5, 6, 7]);
  if (parsed.data.roles.some((role) => (
    !knownRoleIds.has(role.id)
    || role.permission_ids.some((permissionId) => !knownPermissionIds.has(permissionId))
  ))) {
    return c.json({ error: 'Validation Error', message: 'Role or permission IDs are not recognized.' }, 400);
  }

  await db.transaction(async (tx) => {
    for (const role of parsed.data.roles) {
      await tx.delete(rolePermissions).where(eq(rolePermissions.role_id, role.id));
      if (role.permission_ids.length > 0) {
        await tx.insert(rolePermissions).values(
          role.permission_ids.map((permission_id) => ({
            role_id: role.id,
            permission_id,
          })),
        );
      }
    }
  });

  return c.json({ data: parsed.data });
});

export default settingsRoutes;
