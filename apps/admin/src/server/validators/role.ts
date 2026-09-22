import { z } from 'zod';

import { minimise } from '@/lib/auth/permissions';

/**
 * A role, as the Roles screen sends it.
 *
 * The permission list is normalised on the way in rather than trusted:
 * `minimise` drops anything the request does not recognise — a permission
 * string from a release that has been rolled back, or one typed by hand — and
 * then drops whatever a higher action already implies, so the stored row is
 * the smallest true statement of what the role may do.
 */
export const permissionsField = z
  .array(z.string())
  .max(400)
  .transform((held) => minimise(held))
  .refine((held) => !held.includes('*'), {
    /* The wildcard would also grant every resource added in a later release,
       to a role nobody reviewed again. Only the owner holds it, and the owner
       role is not editable. */
    message: 'Tick the permissions this role needs. Only the owner holds all of them.',
  });

export const roleCreateSchema = z.object({
  name: z.string().min(1, 'Give the role a name.').max(60),
  description: z.string().max(300).nullable().optional(),
  permissions: permissionsField,
});

export const roleUpdateSchema = z.object({
  name: z.string().min(1, 'Give the role a name.').max(60).optional(),
  description: z.string().max(300).nullable().optional(),
  permissions: permissionsField.optional(),
  /**
   * Ends every session held by somebody in this role.
   *
   * Off by default, and *not* a faster way to apply the change: a role edit
   * reaches a signed-in browser at its next refresh either way, and the
   * fifteen minutes an access token has left cannot be taken back without
   * putting Prisma in the middleware. What this does is stop the refresh from
   * succeeding at all, so everybody in the role has to type their password
   * again — which is what you want when the reason for the edit is that
   * somebody should not have had the access in the first place.
   */
  signOutEveryone: z.boolean().optional(),
});
