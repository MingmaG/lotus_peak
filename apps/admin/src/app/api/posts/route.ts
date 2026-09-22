import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { publishing, seoColumns } from '@/server/services/catalogue';
import { freeSlug } from '@/server/services/resource';
import { revalidateFor } from '@/server/services/revalidate';
import { stripRichTextMedia } from '@/server/schema/rich-text';
import { postSchema, readingMinutes } from '@/server/validators/post';

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
              { region: { contains: q.search, mode: 'insensitive' } },
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
          region: true,
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
    const row = await db.post.create({
      data: {
        slug: await freeSlug('post', body.slug || body.title),
        title: body.title,
        standfirst: body.standfirst,
        region: body.region,
        /* The URL inside each figure is derived from its media id and is put
           back on the way out, so it is taken out on the way in — a URL in the
           column is the thing that goes stale when the store moves. */
        body: stripRichTextMedia(body.body),
        readingMinutes: readingMinutes(body.body, body.standfirst),
        heroId: body.heroId ?? null,
        /* Whoever wrote it, unless somebody else is named. */
        authorId: body.authorId ?? user.id,
        tags: body.tags,
        featured: body.featured,
        sortOrder: body.sortOrder ?? (await db.post.count()),
        ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
        ...seoColumns(body.seo),
        tripLinks: {
          create: body.relatedTripIds.map((tripId, index) => ({ tripId, sortOrder: index })),
        },
      },
    });

    audit({ action: 'CREATE', entity: 'post', entityId: row.id, entityLabel: row.title });
    if (row.status === 'PUBLISHED') void revalidateFor('post', [`/journal/${row.slug}`]);
    return { post: row };
  },
});
