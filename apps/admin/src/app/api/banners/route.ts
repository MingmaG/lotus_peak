import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { reorder } from '@/server/services/catalogue';
import { serialiseMediaRow } from '@/server/services/media-serialise';
import { MEDIA_THUMB } from '@/server/services/resource';
import { revalidateFor } from '@/server/services/revalidate';
import { reorderSchema } from '@/server/validators/catalogue';
import { bannerSchema } from '@/server/validators/notice';

export const GET = route({
  permission: 'banners.read',
  handler: async () => {
    const rows = await db.banner.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { image: MEDIA_THUMB },
    });
    return {
      items: rows.map((row) => ({
        ...row,
        image: row.image ? serialiseMediaRow(row.image) : null,
      })),
    };
  },
});

export const POST = route<z.infer<typeof bannerSchema>>({
  permission: 'banners.write',
  schema: bannerSchema,
  handler: async ({ body, audit }) => {
    const row = await db.banner.create({
      data: {
        ...body,
        imageId: body.imageId ?? null,
        sortOrder: body.sortOrder ?? (await db.banner.count({ where: { deletedAt: null } })),
      },
    });
    audit({ action: 'CREATE', entity: 'banner', entityId: row.id, entityLabel: row.name || row.heading });
    void revalidateFor('notice');
    return { item: row };
  },
});

export const PATCH = route<z.infer<typeof reorderSchema>>({
  permission: 'banners.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('banner', body.ids);
    audit({ action: 'UPDATE', entity: 'banner', entityLabel: 'order' });
    void revalidateFor('notice');
    return null;
  },
});
