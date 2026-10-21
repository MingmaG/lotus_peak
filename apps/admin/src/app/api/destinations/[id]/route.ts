import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { publishing, seoColumns } from '@/server/services/catalogue';
import { destinationPath } from '@/server/services/content-paths';
import { checkParent } from '@/server/services/destination';
import { redirectMoved } from '@/server/services/publish';
import { revalidateFor } from '@/server/services/revalidate';
import { stripRichTextMedia } from '@/server/schema/rich-text';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { destinationSchema } from '@/server/validators/catalogue';

const patchSchema = destinationSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'destinations.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.destination.findUnique({
      where: { id: params.id },
      include: {
        parent: { select: { slug: true } },
        places: { where: { deletedAt: null }, select: { slug: true } },
      },
    });
    if (!before) throw notFound('That place');

    const parentId = body.parentId === undefined ? before.parentId : body.parentId;
    if (parentId !== before.parentId) {
      await checkParent({ id: before.id, parentId, hasPlaces: before.places.length > 0 });
    }

    let slug = before.slug;
    let slugHistory = before.slugHistory;
    if (body.slug && toSlug(body.slug) !== before.slug) {
      const taken = await db.destination.findMany({
        where: { id: { not: before.id } },
        select: { slug: true },
      });
      slug = uniqueSlug(toSlug(body.slug), taken.map((row) => row.slug));
      slugHistory = [...new Set([...before.slugHistory, before.slug])].filter((s) => s !== slug);
    }

    const row = await db.destination.update({
      where: { id: params.id },
      data: {
        slug,
        slugHistory,
        parentId,
        name: body.name,
        icon: body.icon,
        blurb: body.blurb,
        standfirst: body.standfirst,
        /* `!== undefined`: a body emptied on purpose sends `''`. */
        ...(body.body !== undefined ? { body: stripRichTextMedia(body.body) } : {}),
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
      include: { parent: { select: { slug: true } } },
    });

    /**
     * Every URL this save moved keeps answering.
     *
     * A place's address has its valley's slug in it, so there are three ways
     * a page moves here without anybody touching its own slug field: its
     * valley is renamed, it is moved to another valley, or it becomes a valley
     * itself. Each of the valley's places moves with a rename, too. The
     * redirects are written for all of them — a place that quietly 404s
     * because its valley was tidied up is the failure nobody sees for a month.
     */
    const oldPath = destinationPath(before.slug, before.parent?.slug);
    const newPath = destinationPath(row.slug, row.parent?.slug);
    const paths = [newPath];
    if (oldPath !== newPath) {
      await redirectMoved({
        from: oldPath,
        to: newPath,
        note: `Written automatically when “${row.name}” moved.`,
      });
      paths.push(oldPath);
    }
    if (before.slug !== row.slug) {
      for (const place of before.places) {
        await redirectMoved({
          from: destinationPath(place.slug, before.slug),
          to: destinationPath(place.slug, row.slug),
          note: `Written automatically when “${row.name}” was renamed.`,
        });
        paths.push(destinationPath(place.slug, row.slug), destinationPath(place.slug, before.slug));
      }
    }

    const changes = diff(before as never, row as never);
    audit({
      action: 'UPDATE',
      entity: 'destination',
      entityId: row.id,
      entityLabel: row.name,
      before: changes.before as never,
      after: changes.after as never,
    });

    const push = await revalidateFor('destination', paths);
    return { destination: row, path: newPath, revalidated: push };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'destinations.delete',
  handler: async ({ params, audit }) => {
    const row = await db.destination.findUnique({
      where: { id: params.id },
      include: { _count: { select: { places: { where: { deletedAt: null } } } } },
    });
    if (!row) throw notFound('That place');

    /**
     * A valley with places in it is not removed.
     *
     * Its places' addresses are made of its slug, and a place whose valley has
     * gone has no URL at all. Moving them or removing them first is one extra
     * step for the office and no orphaned pages for anybody.
     */
    if (row._count.places > 0) {
      throw new ApiError(
        409,
        'HAS_PLACES',
        `${row.name} still has ${row._count.places} place${row._count.places === 1 ? '' : 's'} in it. Move or remove those first.`,
      );
    }

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
