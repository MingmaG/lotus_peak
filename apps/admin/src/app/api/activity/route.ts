import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';

/**
 * Who changed what.
 *
 * Read-only, by design. An audit log with a delete button is an audit log.
 */
export const GET = route({
  permission: 'activity.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.ActivityLogWhereInput = {
      ...(q.search
        ? {
            OR: [
              { entityLabel: { contains: q.search, mode: 'insensitive' } },
              { entity: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(searchParams.get('entity') && searchParams.get('entity') !== 'all'
        ? { entity: searchParams.get('entity') as string }
        : {}),
      ...(searchParams.get('user') && searchParams.get('user') !== 'all'
        ? { userId: searchParams.get('user') }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { user: { select: { id: true, name: true } } },
      }),
      db.activityLog.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});
