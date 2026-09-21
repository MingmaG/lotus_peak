import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { publishing, reorder } from '@/server/services/catalogue';
import { MEDIA_THUMB } from '@/server/services/resource';
import { serialiseMediaRow } from '@/server/services/media-serialise';
import { revalidateFor } from '@/server/services/revalidate';
import { personSchema, reorderSchema } from '@/server/validators/catalogue';

export const GET = route({
  permission: 'people.read',
  handler: async () => {
    const rows = await db.person.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { photo: MEDIA_THUMB },
    });
    return {
      items: rows.map((row) => ({
        ...row,
        photo: row.photo ? serialiseMediaRow(row.photo) : null,
      })),
    };
  },
});

export const POST = route<z.infer<typeof personSchema>>({
  permission: 'people.write',
  schema: personSchema,
  handler: async ({ body, audit }) => {
    const row = await db.person.create({
      data: {
        name: body.name,
        role: body.role,
        bio: body.bio,
        photoId: body.photoId ?? null,
        languages: body.languages,
        socials: body.socials as never,
        sortOrder: body.sortOrder ?? (await db.person.count()),
        ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
      },
    });
    audit({ action: 'CREATE', entity: 'person', entityId: row.id, entityLabel: row.name });
    void revalidateFor('person');
    return { item: row };
  },
});

export const PATCH = route<z.infer<typeof reorderSchema>>({
  permission: 'people.write',
  schema: reorderSchema,
  handler: async ({ body, audit }) => {
    await reorder('person', body.ids);
    audit({ action: 'UPDATE', entity: 'person', entityLabel: 'order' });
    void revalidateFor('person');
    return null;
  },
});
