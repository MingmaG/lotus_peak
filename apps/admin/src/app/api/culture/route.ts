import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { publishing, reorder, seoColumns } from '@/server/services/catalogue';
import { culturePath } from '@/server/services/content-paths';
import { MEDIA_THUMB, freeSlug } from '@/server/services/resource';
import { serialiseMediaRow } from '@/server/services/media-serialise';
import { revalidateFor } from '@/server/services/revalidate';
import { stripRichTextMedia } from '@/server/schema/rich-text';
import { cultureSchema, reorderSchema } from '@/server/validators/catalogue';

export const GET = route({
  permission: 'culture.read',
  handler: async () => {
    const rows = await db.cultureArticle.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        image: MEDIA_THUMB,
        _count: { select: { destinations: true } },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        standfirst: row.standfirst,
        status: row.status,
        path: culturePath(row.slug),
        placeCount: row._count.destinations,
        image: row.image ? serialiseMediaRow(row.image) : null,
      })),
    };
  },
});

export const POST = route<z.infer<typeof cultureSchema>>({
  permission: 'culture.write',
  schema: cultureSchema,
  handler: async ({ body, audit }) => {
    const row = await db.cultureArticle.create({
      data: {
        slug: await freeSlug('cultureArticle', body.slug || body.title),
        title: body.title,
        standfirst: body.standfirst,
        body: stripRichTextMedia(body.body),
        icon: body.icon,
        imageId: body.imageId ?? null,
        sortOrder: body.sortOrder ?? (await db.cultureArticle.count()),
        ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
        ...seoColumns(body.seo),
        destinations: {
          create: body.destinationIds.map((destinationId, index) => ({
            destinationId,
            sortOrder: index,
          })),
        },
      },
    });
    audit({ action: 'CREATE', entity: 'culture', entityId: row.id, entityLabel: row.title });
    void revalidateFor('culture');
    return { item: row };
  },
});

export const PATCH = route<z.infer<typeof reorderSchema>>({
  permission: 'culture.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('cultureArticle', body.ids);
    audit({ action: 'UPDATE', entity: 'culture', entityLabel: 'order' });
    void revalidateFor('culture');
    return null;
  },
});
