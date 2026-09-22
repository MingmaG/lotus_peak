import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { can } from '@/lib/auth/permissions';
import { roleUpdateSchema } from '@/server/validators/role';

/**
 * One role.
 *
 * Most of this file is the three ways editing a role locks the office out of
 * the panel, and the refusals that stop each one. None of them can be undone
 * from inside the panel afterwards — the only way back is a database client,
 * which on a Friday evening in Thimphu means Monday.
 */

/** The owner is the floor the rest of this stands on. It does not change. */
const OWNER = 'owner';

export const PATCH = route<z.infer<typeof roleUpdateSchema>, { id: string }>({
  permission: 'roles.write',
  schema: roleUpdateSchema,
  handler: async ({ params, body, user: actor, audit }) => {
    const before = await db.role.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That role');

    /**
     * The owner role is fixed.
     *
     * It holds `*`, and `*` is what the last-owner guard on `/api/users`
     * assumes when it refuses to demote the final owner. Allow this row to be
     * edited and that guard starts protecting an account that can no longer do
     * anything.
     */
    if (before.slug === OWNER) {
      throw new ApiError(
        409,
        'OWNER_ROLE',
        'The owner role cannot be changed — it is what guarantees somebody can always get back in. Make a role of your own instead, or move people out of Owner.',
      );
    }

    /**
     * Nobody edits away their own way back to this screen.
     *
     * Removing `roles.write` from the role you are signed in as is the mistake
     * that has no undo: the screen that could give it back is the screen it
     * closes. An owner is exempt because an owner holds `*` and is not here.
     */
    if (body.permissions && params.id === (await roleIdOf(actor.id))) {
      if (!can(body.permissions, 'roles.write')) {
        throw new ApiError(
          409,
          'SELF',
          'That would remove your own permission to edit roles, and this is the screen that grants it. Ask an owner, or give another role the permission first.',
        );
      }
      if (!can(body.permissions, 'users.read')) {
        throw new ApiError(
          409,
          'SELF',
          'That would hide the Accounts screen from you, and the Roles list lives on it.',
        );
      }
    }

    const role = await db.role.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description === undefined ? undefined : body.description || null,
        permissions: body.permissions,
      },
      select: { id: true, name: true, slug: true },
    });

    let signedOut = 0;
    if (body.signOutEveryone) {
      signedOut = await revokeRoleSessions(params.id);
    }

    audit({
      action: 'UPDATE',
      entity: 'role',
      entityId: role.id,
      entityLabel: role.name,
      before: { name: before.name, permissions: before.permissions },
      after: { name: role.name, permissions: body.permissions ?? before.permissions },
    });

    return { role, signedOut };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'roles.delete',
  handler: async ({ params, audit }) => {
    const role = await db.role.findUnique({ where: { id: params.id } });
    if (!role) throw notFound('That role');

    if (role.isSystem) {
      throw new ApiError(
        409,
        'SYSTEM_ROLE',
        `${role.name} is one of the roles this panel ships with and cannot be removed. Take its permissions away instead, or move everybody out of it.`,
      );
    }

    /* Counting the live rows only: a role held by nobody but three removed
       accounts is a role nobody is using. `roleId` is required on a user, so
       deleting a role that is in use is a foreign-key error rather than a
       sentence, which is why this asks first. */
    const holders = await db.user.count({ where: { roleId: params.id, deletedAt: null } });
    if (holders > 0) {
      throw new ApiError(
        409,
        'ROLE_IN_USE',
        holders === 1
          ? 'Somebody still has this role. Give them another one first.'
          : `${holders} people still have this role. Give them another one first.`,
      );
    }

    await db.role.delete({ where: { id: params.id } });

    audit({
      action: 'DELETE',
      entity: 'role',
      entityId: role.id,
      entityLabel: role.name,
      before: { permissions: role.permissions },
    });

    return null;
  },
});

async function roleIdOf(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { roleId: true } });
  return user?.roleId ?? null;
}

/**
 * Ends every live session held by somebody in this role.
 *
 * Two queries rather than one `updateMany` through the relation, because the
 * session ids are also what tells the caller how many people were signed out —
 * "nobody was signed in" and "eleven people now have to sign in again" are
 * different sentences and the screen says which happened.
 */
async function revokeRoleSessions(roleId: string): Promise<number> {
  const users = await db.user.findMany({ where: { roleId }, select: { id: true } });
  if (users.length === 0) return 0;

  const result = await db.session.updateMany({
    where: { userId: { in: users.map((user) => user.id) }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
