import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { publishing } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { galleryImageSchema } from '@/server/validators/catalogue';

const patchSchema = galleryImageSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'gallery.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.galleryImage.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That photograph');

    const row = await db.galleryImage.update({
      where: { id: params.id },
      data: {
        caption: body.caption,
        ratio: body.ratio === undefined ? undefined : body.ratio,
        sortOrder: body.sortOrder,
        ...publishing({
          next: body.status,
          currentStatus: before.status,
          currentPublishedAt: before.publishedAt,
        }),
      },
    });

    audit({ action: 'UPDATE', entity: 'gallery', entityId: row.id, entityLabel: row.caption });
    return { item: row, revalidated: await revalidateFor('gallery') };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'gallery.delete',
  handler: async ({ params, audit }) => {
    const row = await db.galleryImage.findUnique({ where: { id: params.id } });
    if (!row) throw notFound('That photograph');

    /**
     * A real delete, unusually.
     *
     * A gallery entry is a caption pointing at a photograph; the photograph
     * itself is untouched and stays in the library. There is nothing here to
     * recover that the media row does not already hold, so a `deletedAt` would
     * be a hidden row nobody can find and nobody wants.
     */
    await db.galleryImage.delete({ where: { id: params.id } });

    audit({ action: 'DELETE', entity: 'gallery', entityId: row.id, entityLabel: row.caption });
    void revalidateFor('gallery');
    return null;
  },
});
