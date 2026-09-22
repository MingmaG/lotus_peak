import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { nextSlug, publishing, reorder, seoColumns } from '@/server/services/catalogue';
import { checkParent } from '@/server/services/destination';
import { destinationPath } from '@/server/services/content-paths';
import { revalidateFor } from '@/server/services/revalidate';
import { stripRichTextMedia } from '@/server/schema/rich-text';
import { destinationSchema, reorderSchema, type DestinationInput } from '@/server/validators/catalogue';
import { serialiseMediaRow } from '@/server/services/media-serialise';

const MEDIA = { include: { renditions: { where: { format: 'webp' as const } } } };

/**
 * Every valley and every place, flat, in order.
 *
 * Flat rather than nested because the two screens that read it want different
 * cuts: the list draws the valleys, and a valley's page draws its own places.
 * `parentId` is on every row, and filtering six to thirty rows in the browser
 * is cheaper than a second endpoint that can disagree with this one.
 */
export const GET = route({
  permission: 'destinations.read',
  handler: async () => {
    const rows = await db.destination.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        image: MEDIA,
        parent: { select: { slug: true, name: true } },
        _count: { select: { places: { where: { deletedAt: null } } } },
        trips: {
          orderBy: { offerOrder: 'asc' },
          include: { trip: { select: { id: true, title: true, slug: true } } },
        },
      },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        blurb: row.blurb,
        standfirst: row.standfirst,
        status: row.status,
        parentId: row.parentId,
        parentName: row.parent?.name ?? null,
        path: destinationPath(row.slug, row.parent?.slug),
        placeCount: row._count.places,
        image: row.image ? serialiseMediaRow(row.image) : null,
        trips: row.trips.map((link) => ({
          ...link.trip,
          offered: link.offerOrder !== null,
        })),
      })),
    };
  },
});

export const POST = route<DestinationInput>({
  permission: 'destinations.write',
  schema: destinationSchema,
  handler: async ({ body, audit }) => {
    const parentId = body.parentId ?? null;
    await checkParent({ id: null, parentId });

    const row = await db.destination.create({
      data: {
        slug: await nextSlug('destination', body.slug || body.name),
        name: body.name,
        parentId,
        icon: body.icon,
        blurb: body.blurb,
        standfirst: body.standfirst,
        /* Figures keep their media id and lose their URL on the way in; see
           `stripRichTextMedia`. */
        body: stripRichTextMedia(body.body),
        imageId: body.imageId ?? null,
        altitudeMetres: body.altitudeMetres ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        /* Last among its siblings: a new place goes to the foot of its
           valley's list, a new valley to the foot of Where we go. */
        sortOrder:
          body.sortOrder ?? (await db.destination.count({ where: { parentId, deletedAt: null } })),
        ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
        ...seoColumns(body.seo),
      },
    });

    audit({ action: 'CREATE', entity: 'destination', entityId: row.id, entityLabel: row.name });
    void revalidateFor('destination');
    return { destination: row };
  },
});

export const PATCH = route<import('zod').infer<typeof reorderSchema>>({
  permission: 'destinations.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('destination', body.ids);
    audit({ action: 'UPDATE', entity: 'destination', entityLabel: 'order' });
    void revalidateFor('destination');
    return null;
  },
});
