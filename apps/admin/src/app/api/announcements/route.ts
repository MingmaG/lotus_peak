import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { reorder } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { reorderSchema } from '@/server/validators/catalogue';
import { announcementSchema } from '@/server/validators/notice';

/**
 * Announcements live under the `banners` permission.
 *
 * They are the same job — a notice on the website that runs between two dates
 * — and they are on the same screen. A separate permission would be a second
 * box to tick on every role for one screen's worth of work.
 */
export const GET = route({
  permission: 'banners.read',
  handler: async () => ({
    items: await db.announcement.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    }),
  }),
});

export const POST = route<z.infer<typeof announcementSchema>>({
  permission: 'banners.write',
  schema: announcementSchema,
  handler: async ({ body, audit }) => {
    const row = await db.announcement.create({
      data: {
        ...body,
        sortOrder: body.sortOrder ?? (await db.announcement.count({ where: { deletedAt: null } })),
      },
    });
    audit({ action: 'CREATE', entity: 'announcement', entityId: row.id, entityLabel: row.name });
    void revalidateFor('notice');
    return { item: row };
  },
});

export const PATCH = route<z.infer<typeof reorderSchema>>({
  permission: 'banners.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('announcement', body.ids);
    audit({ action: 'UPDATE', entity: 'announcement', entityLabel: 'order' });
    void revalidateFor('notice');
    return null;
  },
});
