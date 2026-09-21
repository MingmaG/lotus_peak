import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { publishing } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { reflectionSchema } from '@/server/validators/catalogue';

const patchSchema = reflectionSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'reflections.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.reflection.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That reflection');

    const row = await db.reflection.update({
      where: { id: params.id },
      data: {
        quote: body.quote,
        name: body.name,
        detail: body.detail === undefined ? undefined : body.detail || null,
        tripId: body.tripId === undefined ? undefined : body.tripId,
        featured: body.featured,
        sortOrder: body.sortOrder,
        ...publishing({
          next: body.status,
          currentStatus: before.status,
          currentPublishedAt: before.publishedAt,
        }),
      },
    });

    audit({ action: 'UPDATE', entity: 'reflection', entityId: row.id, entityLabel: row.name });
    return { item: row, revalidated: await revalidateFor('reflection') };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'reflections.delete',
  handler: async ({ params, audit }) => {
    const row = await db.reflection.findUnique({ where: { id: params.id } });
    if (!row) throw notFound('That reflection');
    await db.reflection.delete({ where: { id: params.id } });
    audit({ action: 'DELETE', entity: 'reflection', entityId: row.id, entityLabel: row.name });
    void revalidateFor('reflection');
    return null;
  },
});
