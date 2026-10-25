import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';
import { bannerPatchSchema } from '@/server/validators/notice';

export const PATCH = route<z.infer<typeof bannerPatchSchema>, { id: string }>({
  permission: 'banners.write',
  schema: bannerPatchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.banner.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!before) throw notFound('That banner');

    const row = await db.banner.update({ where: { id: params.id }, data: body });
    audit({ action: 'UPDATE', entity: 'banner', entityId: row.id, entityLabel: row.name || row.heading });
    return { item: row, revalidated: await revalidateFor('notice') };
  },
});

/** Soft, as announcements are: a seasonal banner comes back next season. */
export const DELETE = route<undefined, { id: string }>({
  permission: 'banners.delete',
  handler: async ({ params, audit }) => {
    const row = await db.banner.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!row) throw notFound('That banner');
    await db.banner.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    audit({ action: 'DELETE', entity: 'banner', entityId: row.id, entityLabel: row.name || row.heading });
    void revalidateFor('notice');
    return null;
  },
});
