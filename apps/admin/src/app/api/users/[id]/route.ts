import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { hashPassword } from '@/lib/auth/password';
import { revokeAllSessions } from '@/lib/auth/session';

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(12).max(200).optional(),
  /** Unlocks an account that has been locked out by failed attempts. */
  unlock: z.boolean().optional(),
  /** Signs them out of every browser. */
  signOutEverywhere: z.boolean().optional(),
});

export const PATCH = route<z.infer<typeof schema>, { id: string }>({
  permission: 'users.write',
  schema,
  handler: async ({ params, body, user: actor, audit }) => {
    const before = await db.user.findUnique({
      where: { id: params.id },
      include: { role: true },
    });
    if (!before) throw notFound('That account');

    /**
     * Nobody can deactivate or demote themselves.
     *
     * Not paternalism — it is the one mistake that cannot be undone from
     * inside the panel. An owner who removes their own `users.write` has
     * locked everybody out of the screen that could give it back, and the only
     * way in is a database client.
     */
    if (params.id === actor.id) {
      if (body.isActive === false) {
        throw new ApiError(
          409,
          'SELF',
          'You cannot deactivate your own account — you would not be able to sign back in to undo it.',
        );
      }
      if (body.roleId && body.roleId !== before.roleId) {
        throw new ApiError(
          409,
          'SELF',
          'You cannot change your own role. Ask another owner, so nobody can lock themselves out of this screen.',
        );
      }
    }

    /**
     * The last owner stays an owner.
     *
     * The same failure by a different route: demoting the only account with
     * `users.write` leaves nobody who can promote anybody.
     */
    if (before.role.slug === 'owner' && (body.roleId || body.isActive === false)) {
      const owners = await db.user.count({
        where: { role: { slug: 'owner' }, isActive: true, deletedAt: null },
      });
      if (owners <= 1) {
        throw new ApiError(
          409,
          'LAST_OWNER',
          'This is the only owner. Make somebody else an owner first, or there will be nobody who can manage accounts.',
        );
      }
    }

    const updated = await db.user.update({
      where: { id: params.id },
      data: {
        name: body.name,
        jobTitle: body.jobTitle === undefined ? undefined : body.jobTitle || null,
        phone: body.phone === undefined ? undefined : body.phone || null,
        roleId: body.roleId,
        isActive: body.isActive,
        ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
        ...(body.unlock ? { lockedUntil: null, failedLogins: 0 } : {}),
      },
      select: { id: true, name: true, email: true },
    });

    /* A new password, a deactivation or an explicit request all end every
       session. A password change that left old sessions alive would be a
       password change that does not lock anybody out. */
    if (body.password || body.isActive === false || body.signOutEverywhere) {
      await revokeAllSessions(params.id);
    }

    audit({
      action: 'UPDATE',
      entity: 'user',
      entityId: updated.id,
      entityLabel: updated.email,
      /* Never the hash, and never the password. */
      after: {
        name: body.name,
        roleId: body.roleId,
        isActive: body.isActive,
        passwordChanged: Boolean(body.password),
      },
    });

    return { user: updated };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'users.delete',
  handler: async ({ params, user: actor, audit }) => {
    if (params.id === actor.id) {
      throw new ApiError(409, 'SELF', 'You cannot remove your own account.');
    }

    const user = await db.user.findUnique({ where: { id: params.id } });
    if (!user) throw notFound('That account');

    await db.user.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await revokeAllSessions(params.id);

    audit({ action: 'DELETE', entity: 'user', entityId: user.id, entityLabel: user.email });
    return null;
  },
});
