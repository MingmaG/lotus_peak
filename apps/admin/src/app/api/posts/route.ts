import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { createPost } from '@/server/services/post';
import { revalidateFor } from '@/server/services/revalidate';
import { postSchema } from '@/server/validators/post';

export const GET = route({
  permission: 'journal.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { standfirst: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.status && q.status !== 'all' ? { status: q.status as never } : {}),
    };

    const [rows, total] = await Promise.all([
      db.post.findMany({
        where,
        orderBy: q.sort === 'title' ? { title: q.direction } : { publishedAt: q.direction },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          slug: true,
          title: true,
          standfirst: true,
          category: true,
          status: true,
          featured: true,
          readingMinutes: true,
          publishedAt: true,
          updatedAt: true,
          author: { select: { name: true } },
        },
      }),
      db.post.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});

export const POST = route<z.infer<typeof postSchema>>({
  permission: 'journal.write',
  schema: postSchema,
  handler: async ({ body, user, audit }) => {
    const row = await createPost(body, user.id);

    audit({ action: 'CREATE', entity: 'post', entityId: row.id, entityLabel: row.title });
    if (row.status === 'PUBLISHED') void revalidateFor('post', [`/journal/${row.slug}`]);
    return { post: row };
  },
});
