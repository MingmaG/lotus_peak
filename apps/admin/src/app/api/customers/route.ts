import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';

/**
 * Everybody who has written in more than once, and everybody who has not.
 *
 * A customer row is created by hand rather than automatically from an enquiry:
 * two enquiries from one address are often two different people at the same
 * organisation, and merging them silently loses the distinction. The Enquiries
 * screen offers to link one.
 */
export const GET = route({
  permission: 'customers.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { country: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { _count: { select: { enquiries: true } } },
      }),
      db.customer.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});
