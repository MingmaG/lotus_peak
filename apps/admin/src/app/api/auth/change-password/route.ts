import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, route } from '@/lib/api/handler';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { revokeAllSessions } from '@/lib/auth/session';

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(12, 'Twelve characters at least. A phrase is easier to remember and harder to guess.')
    .max(200)
    .optional(),
});

/**
 * Changing your own details.
 *
 * Separate from `/api/users/[id]` because it asks for the current password —
 * which is what stops somebody who has walked up to an unlocked laptop
 * changing it and keeping the account.
 */
export const PATCH = route<z.infer<typeof schema>>({
  permission: null,
  schema,
  handler: async ({ body, user, audit }) => {
    const row = await db.user.findUnique({ where: { id: user.id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'That account no longer exists.');

    if (body.newPassword) {
      if (!body.currentPassword) {
        throw new ApiError(422, 'VALIDATION_FAILED', 'Enter your current password.', {
          currentPassword: 'Required to set a new one.',
        });
      }
      const correct = await verifyPassword(body.currentPassword, row.passwordHash);
      if (!correct) {
        throw new ApiError(422, 'VALIDATION_FAILED', 'That is not your current password.', {
          currentPassword: 'That does not match.',
        });
      }
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        jobTitle: body.jobTitle === undefined ? undefined : body.jobTitle || null,
        phone: body.phone === undefined ? undefined : body.phone || null,
        ...(body.newPassword ? { passwordHash: await hashPassword(body.newPassword) } : {}),
      },
    });

    /**
     * A new password ends every session, including this one.
     *
     * The commonest reason to change a password is that somebody else may know
     * it, and leaving their session alive would be leaving the door open.
     */
    if (body.newPassword) await revokeAllSessions(user.id);

    audit({
      action: 'UPDATE',
      entity: 'user',
      entityId: user.id,
      entityLabel: row.email,
      after: { self: true, passwordChanged: Boolean(body.newPassword) },
    });

    return { signedOut: Boolean(body.newPassword) };
  },
});
