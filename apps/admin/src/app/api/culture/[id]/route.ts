import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { moveSlug, publishing, seoColumns } from '@/server/services/catalogue';
import { culturePath } from '@/server/services/content-paths';
import { revalidateFor } from '@/server/services/revalidate';
import { stripRichTextMedia } from '@/server/schema/rich-text';
import { cultureSchema } from '@/server/validators/catalogue';

const patchSchema = cultureSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'culture.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.cultureArticle.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That article');

    const moved = body.slug
      ? await moveSlug({
          entity: 'culture',
          currentSlug: before.slug,
          currentHistory: before.slugHistory,
          nextSlug: body.slug,
        })
      : null;

    const row = await db.cultureArticle.update({
      where: { id: params.id },
      data: {
        ...(moved ? { slug: moved.slug, slugHistory: moved.slugHistory } : {}),
        title: body.title,
        standfirst: body.standfirst,
        ...(body.body !== undefined ? { body: stripRichTextMedia(body.body) } : {}),
        icon: body.icon,
        imageId: body.imageId === undefined ? undefined : body.imageId,
        sortOrder: body.sortOrder,
        ...publishing({
          next: body.status,
          currentStatus: before.status,
          currentPublishedAt: before.publishedAt,
        }),
        ...seoColumns(body.seo),
        ...(body.destinationIds
          ? {
              destinations: {
                deleteMany: {},
                create: body.destinationIds.map((destinationId, index) => ({
                  destinationId,
                  sortOrder: index,
                })),
              },
            }
          : {}),
      },
    });

    const changes = diff(before as never, row as never);
    audit({
      action: 'UPDATE',
      entity: 'culture',
      entityId: row.id,
      entityLabel: row.title,
      before: changes.before as never,
      after: changes.after as never,
    });

    const paths = [culturePath(row.slug)];
    if (before.slug !== row.slug) paths.push(culturePath(before.slug));
    return { item: row, path: culturePath(row.slug), revalidated: await revalidateFor('culture', paths) };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'culture.delete',
  handler: async ({ params, audit }) => {
    const row = await db.cultureArticle.findUnique({ where: { id: params.id } });
    if (!row) throw notFound('That article');
    await db.cultureArticle.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    audit({ action: 'DELETE', entity: 'culture', entityId: row.id, entityLabel: row.title });
    void revalidateFor('culture', [culturePath(row.slug)]);
    return null;
  },
});
