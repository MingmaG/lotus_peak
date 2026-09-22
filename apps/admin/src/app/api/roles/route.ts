import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { roleCreateSchema } from '@/server/validators/role';
import { uniqueSlug } from '@/lib/slug';

/**
 * The roles, and what each one is allowed to do.
 *
 * Behind `roles.*` rather than `users.write`, because the two are different
 * powers. Adding a receptionist is an everyday job; changing what
 * "Receptionist" means is how somebody grants themselves the enquiries table,
 * and an account that may do the first should not silently be able to do the
 * second.
 */

export const GET = route({
  permission: 'roles.read',
  handler: async () => {
    const roles = await db.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        permissions: true,
        isSystem: true,
      },
    });

    /**
     * Counted separately rather than with `_count`, so the tally can exclude
     * the people who have been removed. A role showing "3 people" that cannot
     * be deleted because two of them are deleted rows is a dead end with no
     * explanation on the screen.
     */
    const counts = await db.user.groupBy({
      by: ['roleId'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const byRole = new Map(counts.map((row) => [row.roleId, row._count._all]));

    return {
      roles: roles.map((role) => ({ ...role, userCount: byRole.get(role.id) ?? 0 })),
    };
  },
});

export const POST = route<z.infer<typeof roleCreateSchema>>({
  permission: 'roles.write',
  schema: roleCreateSchema,
  handler: async ({ body, audit }) => {
    const taken = await db.role.findMany({ select: { slug: true } });
    const slug = uniqueSlug(
      body.name,
      taken.map((role) => role.slug),
    );

    const role = await db.role.create({
      data: {
        name: body.name,
        slug,
        description: body.description || null,
        permissions: body.permissions,
        /* Only the seed makes a system role. One made here belongs to the
           office, and the office may delete it again. */
        isSystem: false,
      },
      select: { id: true, name: true, slug: true },
    });

    audit({
      action: 'CREATE',
      entity: 'role',
      entityId: role.id,
      entityLabel: role.name,
      after: { permissions: body.permissions },
    });

    return { role };
  },
});
