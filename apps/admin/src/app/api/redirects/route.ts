import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';

const schema = z.object({
  source: z
    .string()
    .min(1, 'Which address?')
    .max(500)
    .refine((value) => value.startsWith('/'), 'It has to start with a /.'),
  target: z.string().min(1, 'Where should it go?').max(500),
  type: z.enum(['MOVED_301', 'FOUND_302']).default('MOVED_301'),
  isActive: z.boolean().default(true),
  note: z.string().max(300).nullable().optional(),
});

export const GET = route({
  permission: 'seo.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);
    const where: Prisma.RedirectWhereInput = q.search
      ? {
          OR: [
            { source: { contains: q.search, mode: 'insensitive' } },
            { target: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      db.redirect.findMany({
        where,
        orderBy: [{ hitCount: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      db.redirect.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});

export const POST = route<z.infer<typeof schema>>({
  permission: 'seo.write',
  schema,
  handler: async ({ body, audit }) => {
    const row = await db.redirect.create({
      data: {
        source: body.source,
        target: body.target,
        type: body.type,
        isActive: body.isActive,
        note: body.note || null,
        isAutomatic: false,
      },
    });

    audit({ action: 'CREATE', entity: 'redirect', entityId: row.id, entityLabel: row.source });
    void revalidateFor('redirect');
    return { redirect: row };
  },
});
