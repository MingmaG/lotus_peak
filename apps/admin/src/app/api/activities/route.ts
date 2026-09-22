import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { publishing, reorder, seoColumns } from '@/server/services/catalogue';
import { MEDIA_THUMB, freeSlug } from '@/server/services/resource';
import { serialiseMediaRow } from '@/server/services/media-serialise';
import { revalidateFor } from '@/server/services/revalidate';
import { activitySchema, reorderSchema } from '@/server/validators/catalogue';

const INCLUDE = {
  image: MEDIA_THUMB,
  ogImage: MEDIA_THUMB,
  trips: {
    orderBy: { sortOrder: 'asc' as const },
    include: { trip: { select: { id: true, title: true } } },
  },
};

export const GET = route({
  permission: 'activities.read',
  handler: async () => {
    const rows = await db.activity.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: INCLUDE,
    });

    return {
      items: rows.map((row) => ({
        ...row,
        image: row.image ? serialiseMediaRow(row.image) : null,
        ogImage: row.ogImage ? serialiseMediaRow(row.ogImage) : null,
        trips: row.trips.map((link) => link.trip),
      })),
    };
  },
});

export const POST = route<z.infer<typeof activitySchema>>({
  permission: 'activities.write',
  schema: activitySchema,
  handler: async ({ body, audit }) => {
    const row = await db.activity.create({
      data: {
        slug: await freeSlug('activity', body.slug || body.name),
        name: body.name,
        blurb: body.blurb,
        icon: body.icon,
        kind: body.kind,
        imageId: body.imageId ?? null,
        examples: body.examples,
        sortOrder: body.sortOrder ?? (await db.activity.count()),
        ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
        ...seoColumns(body.seo),
        trips: {
          create: body.tripIds.map((tripId, index) => ({ tripId, sortOrder: index })),
        },
      },
    });

    audit({ action: 'CREATE', entity: 'activity', entityId: row.id, entityLabel: row.name });
    void revalidateFor('activity');
    return { item: row };
  },
});

export const PATCH = route<z.infer<typeof reorderSchema>>({
  permission: 'activities.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('activity', body.ids);
    audit({ action: 'UPDATE', entity: 'activity', entityLabel: 'order' });
    void revalidateFor('activity');
    return null;
  },
});
