import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { publishing } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { personSchema } from '@/server/validators/catalogue';

const patchSchema = personSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'people.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.person.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That person');

    const row = await db.person.update({
      where: { id: params.id },
      data: {
        name: body.name,
        role: body.role,
        bio: body.bio,
        photoId: body.photoId === undefined ? undefined : body.photoId,
        languages: body.languages,
        socials: body.socials === undefined ? undefined : (body.socials as never),
        sortOrder: body.sortOrder,
        ...publishing({
          next: body.status,
          currentStatus: before.status,
          currentPublishedAt: before.publishedAt,
        }),
      },
    });

    audit({ action: 'UPDATE', entity: 'person', entityId: row.id, entityLabel: row.name });
    return { item: row, revalidated: await revalidateFor('person') };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'people.delete',
  handler: async ({ params, audit }) => {
    const row = await db.person.findUnique({ where: { id: params.id } });
    if (!row) throw notFound('That person');
    await db.person.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    audit({ action: 'DELETE', entity: 'person', entityId: row.id, entityLabel: row.name });
    void revalidateFor('person');
    return null;
  },
});
