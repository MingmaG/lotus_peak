import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { nextSlug, publishing, reorder, seoColumns } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { destinationSchema, reorderSchema } from '@/server/validators/catalogue';
import { serialiseMediaRow } from '@/server/services/media-serialise';

const MEDIA = { include: { renditions: { where: { format: 'webp' as const } } } };

export const GET = route({
  permission: 'destinations.read',
  handler: async () => {
    const rows = await db.destination.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        image: MEDIA,
        ogImage: MEDIA,
        trips: {
          orderBy: { offerOrder: 'asc' },
          include: { trip: { select: { id: true, title: true, slug: true } } },
        },
      },
    });

    return {
      items: rows.map((row) => ({
        ...row,
        image: row.image ? serialiseMediaRow(row.image) : null,
        ogImage: row.ogImage ? serialiseMediaRow(row.ogImage) : null,
        trips: row.trips.map((link) => ({
          ...link.trip,
          offered: link.offerOrder !== null,
        })),
      })),
    };
  },
});

export const POST = route<import('zod').infer<typeof destinationSchema>>({
  permission: 'destinations.write',
  schema: destinationSchema,
  handler: async ({ body, audit }) => {
    const row = await db.destination.create({
      data: {
        slug: await nextSlug('destination', body.slug || body.name),
        name: body.name,
        icon: body.icon,
        blurb: body.blurb,
        detail: body.detail,
        imageId: body.imageId ?? null,
        altitudeMetres: body.altitudeMetres ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        sortOrder: body.sortOrder ?? (await db.destination.count()),
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
