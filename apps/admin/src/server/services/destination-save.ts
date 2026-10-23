import 'server-only';

import type { Destination } from '@prisma/client';

import { notFound } from '@/lib/api/handler';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { db } from '@/lib/db';
import { stripRichTextMedia } from '@/server/schema/rich-text';
import type { DestinationInput } from '@/server/validators/catalogue';
import { publishing, seoColumns } from './catalogue';
import { destinationPath } from './content-paths';
import { checkParent } from './destination';
import { redirectMoved } from './publish';

/**
 * Saving a place.
 *
 * Here rather than in the route because two doors lead to it — the panel's
 * editor and an AI client over MCP — and the redirects a move writes are
 * exactly the kind of rule one door would forget.
 */
export async function updateDestination(
  id: string,
  body: Partial<DestinationInput>,
): Promise<{ before: Destination; row: Destination; path: string; paths: string[] }> {
  const before = await db.destination.findUnique({
    where: { id },
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
    where: { id },
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

  return { before, row, path: newPath, paths };
}
