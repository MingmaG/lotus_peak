import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { moveSlug, publishing, seoColumns } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { destinationSchema } from '@/server/validators/catalogue';

const patchSchema = destinationSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'destinations.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.destination.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That place');

    const moved = body.slug
      ? await moveSlug({
          entity: 'destination',
          currentSlug: before.slug,
          currentHistory: before.slugHistory,
          nextSlug: body.slug,
        })
      : null;

    const row = await db.destination.update({
      where: { id: params.id },
      data: {
        ...(moved ? { slug: moved.slug, slugHistory: moved.slugHistory } : {}),
        name: body.name,
        icon: body.icon,
        blurb: body.blurb,
        detail: body.detail,
        imageId: body.imageId === undefined ? undefined : body.imageId,
        altitudeMetres: body.altitudeMetres,
        latitude: body.latitude,
        longitude: body.longitude,
        sortOrder: body.sortOrder,
        ...publishing({
          next: body.status,
          currentStatus: before.status,
          currentPublishedAt: before.publishedAt,
        }),
        ...seoColumns(body.seo),
      },
    });

    const changes = diff(before as never, row as never);
    audit({
      action: 'UPDATE',
      entity: 'destination',
      entityId: row.id,
      entityLabel: row.name,
      before: changes.before as never,
      after: changes.after as never,
    });

    const push = await revalidateFor('destination');
    return { destination: row, revalidated: push };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'destinations.delete',
  handler: async ({ params, audit }) => {
    const row = await db.destination.findUnique({
      where: { id: params.id },
      include: { _count: { select: { trips: true } } },
    });
    if (!row) throw notFound('That place');

    /**
     * Soft, like everything else that a journey points at.
     *
     * A hard delete would cascade the join rows and silently shorten every
     * route through this place — and "why did the sacred valleys journey stop
     * mentioning Trongsa" is a much worse afternoon than a row that is still
     * there and hidden.
     */
    await db.destination.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    audit({ action: 'DELETE', entity: 'destination', entityId: row.id, entityLabel: row.name });
    void revalidateFor('destination');
    return null;
  },
});
