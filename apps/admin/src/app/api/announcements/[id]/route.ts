import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';
import { announcementPatchSchema } from '@/server/validators/notice';

export const PATCH = route<z.infer<typeof announcementPatchSchema>, { id: string }>({
  permission: 'banners.write',
  schema: announcementPatchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.announcement.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!before) throw notFound('That announcement');

    const row = await db.announcement.update({ where: { id: params.id }, data: body });
    audit({ action: 'UPDATE', entity: 'announcement', entityId: row.id, entityLabel: row.name });
    return { item: row, revalidated: await revalidateFor('notice') };
  },
});

/** Soft: last year's Losar offer is a row somebody will want back. */
export const DELETE = route<undefined, { id: string }>({
  permission: 'banners.delete',
  handler: async ({ params, audit }) => {
    const row = await db.announcement.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!row) throw notFound('That announcement');
    await db.announcement.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    audit({ action: 'DELETE', entity: 'announcement', entityId: row.id, entityLabel: row.name });
    void revalidateFor('notice');
    return null;
  },
});
