import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { moveSlug, publishing, seoColumns } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { activitySchema } from '@/server/validators/catalogue';

const patchSchema = activitySchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'activities.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.activity.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That activity');

    const moved = body.slug
      ? await moveSlug({
          entity: 'activity',
          currentSlug: before.slug,
          currentHistory: before.slugHistory,
          nextSlug: body.slug,
        })
      : null;

    const row = await db.activity.update({
      where: { id: params.id },
      data: {
        ...(moved ? { slug: moved.slug, slugHistory: moved.slugHistory } : {}),
        name: body.name,
        blurb: body.blurb,
        icon: body.icon,
        kind: body.kind,
        imageId: body.imageId === undefined ? undefined : body.imageId,
        examples: body.examples,
        sortOrder: body.sortOrder,
        ...publishing({
          next: body.status,
          currentStatus: before.status,
          currentPublishedAt: before.publishedAt,
        }),
        ...seoColumns(body.seo),
        /* The join is replaced whole when it is sent, and left alone when it
           is not — the same rule the journey editor's lists follow. */
        ...(body.tripIds
          ? {
              trips: {
                deleteMany: {},
                create: body.tripIds.map((tripId, index) => ({ tripId, sortOrder: index })),
              },
            }
          : {}),
      },
    });

    const changes = diff(before as never, row as never);
    audit({
      action: 'UPDATE',
      entity: 'activity',
      entityId: row.id,
      entityLabel: row.name,
      before: changes.before as never,
      after: changes.after as never,
    });

    return { item: row, revalidated: await revalidateFor('activity') };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'activities.delete',
  handler: async ({ params, audit }) => {
    const row = await db.activity.findUnique({ where: { id: params.id } });
    if (!row) throw notFound('That activity');

    await db.activity.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    audit({ action: 'DELETE', entity: 'activity', entityId: row.id, entityLabel: row.name });
    void revalidateFor('activity');
    return null;
  },
});
