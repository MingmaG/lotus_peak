import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { serialiseMediaRow } from '@/server/services/media-serialise';

/** The library, searchable and paged. */
export const GET = route({
  permission: 'media.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.MediaWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { filename: { contains: q.search, mode: 'insensitive' } },
              { alt: { contains: q.search, mode: 'insensitive' } },
              { caption: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      /* `?needsAlt=1` — the filter that makes the library's one real backlog
         visible, rather than leaving somebody to scroll for it. */
      ...(searchParams.get('needsAlt') === '1'
        ? { alt: '', isDecorative: false }
        : {}),
      ...(searchParams.get('folderId')
        ? { folderId: searchParams.get('folderId') }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { renditions: { where: { format: 'webp' }, orderBy: { width: 'desc' } } },
      }),
      db.media.count({ where }),
    ]);

    return paginated(rows.map(serialiseMediaRow), total, q);
  },
});
