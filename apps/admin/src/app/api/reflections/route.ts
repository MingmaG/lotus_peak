import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { publishing, reorder } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { reflectionSchema, reorderSchema } from '@/server/validators/catalogue';

export const GET = route({
  permission: 'reflections.read',
  handler: async () => ({
    items: await db.reflection.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { trip: { select: { id: true, title: true } } },
    }),
  }),
});

export const POST = route<z.infer<typeof reflectionSchema>>({
  permission: 'reflections.write',
  schema: reflectionSchema,
  handler: async ({ body, audit }) => {
    const row = await db.reflection.create({
      data: {
        quote: body.quote,
        name: body.name,
        detail: body.detail || null,
        tripId: body.tripId ?? null,
        featured: body.featured,
        sortOrder: body.sortOrder ?? (await db.reflection.count()),
        ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
      },
    });
    audit({ action: 'CREATE', entity: 'reflection', entityId: row.id, entityLabel: row.name });
    void revalidateFor('reflection');
    return { item: row };
  },
});

export const PATCH = route<z.infer<typeof reorderSchema>>({
  permission: 'reflections.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('reflection', body.ids);
    audit({ action: 'UPDATE', entity: 'reflection', entityLabel: 'order' });
    void revalidateFor('reflection');
    return null;
  },
});
