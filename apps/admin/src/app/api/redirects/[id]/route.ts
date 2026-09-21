import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';

const patchSchema = z.object({
  target: z.string().min(1).max(500).optional(),
  type: z.enum(['MOVED_301', 'FOUND_302']).optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(300).nullable().optional(),
});

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'seo.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const row = await db.redirect.update({ where: { id: params.id }, data: body });
    audit({ action: 'UPDATE', entity: 'redirect', entityId: row.id, entityLabel: row.source });
    void revalidateFor('redirect');
    return { redirect: row };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'seo.write',
  handler: async ({ params, audit }) => {
    const row = await db.redirect.findUnique({ where: { id: params.id } });
    if (!row) throw notFound('That redirect');

    /**
     * An automatic redirect cannot be deleted here.
     *
     * It was written when somebody renamed a slug, and it is the only thing
     * keeping the old URL working. Deleting it re-breaks the link it exists to
     * keep — silently, months later, to whoever follows it. Switching it off is
     * offered instead, which is the same effect with a visible cause.
     */
    if (row.isAutomatic) {
      throw new ApiError(
        409,
        'AUTOMATIC',
        'This redirect was written when a page was renamed, and it is what keeps the old address working. Switch it off if you really want to — deleting it would break that link for good.',
      );
    }

    await db.redirect.delete({ where: { id: params.id } });
    audit({ action: 'DELETE', entity: 'redirect', entityId: row.id, entityLabel: row.source });
    void revalidateFor('redirect');
    return null;
  },
});
