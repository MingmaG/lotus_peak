import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { publishing, reorder } from '@/server/services/catalogue';
import { MEDIA_THUMB } from '@/server/services/resource';
import { serialiseMediaRow } from '@/server/services/media-serialise';
import { revalidateFor } from '@/server/services/revalidate';
import { galleryImageSchema, reorderSchema } from '@/server/validators/catalogue';

export const GET = route({
  permission: 'gallery.read',
  handler: async () => {
    const rows = await db.galleryImage.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { media: MEDIA_THUMB },
    });
    return {
      items: rows.map((row) => ({ ...row, media: serialiseMediaRow(row.media) })),
    };
  },
});

/**
 * Adding to the gallery.
 *
 * Takes an array, because the office adds photographs a handful at a time from
 * the picker and one request per picture is a spinner per picture.
 */
const addSchema = z.object({ items: z.array(galleryImageSchema).min(1).max(60) });

export const POST = route<z.infer<typeof addSchema>>({
  permission: 'gallery.write',
  schema: addSchema,
  handler: async ({ body, audit }) => {
    const start = await db.galleryImage.count();

    /* `skipDuplicates` is not available here because there is no unique on
       `mediaId` — the same photograph legitimately appears twice with two
       captions. The screen warns; the database does not forbid it. */
    await db.galleryImage.createMany({
      data: body.items.map((item, index) => ({
        mediaId: item.mediaId,
        caption: item.caption,
        ratio: item.ratio ?? null,
        sortOrder: start + index,
        ...publishing({ next: item.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
      })),
    });

    audit({
      action: 'CREATE',
      entity: 'gallery',
      entityLabel: `${body.items.length} photograph(s)`,
    });
    void revalidateFor('gallery');
    return { added: body.items.length };
  },
});

export const PATCH = route<z.infer<typeof reorderSchema>>({
  permission: 'gallery.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('galleryImage', body.ids);
    audit({ action: 'UPDATE', entity: 'gallery', entityLabel: 'order' });
    void revalidateFor('gallery');
    return null;
  },
});
