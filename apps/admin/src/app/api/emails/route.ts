import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';

/**
 * What was sent.
 *
 * The HTML is not in the list payload — it is several kilobytes per row, and a
 * page of twenty-five would be a megabyte to render a table of subjects. The
 * detail view asks for one.
 */
export const GET = route({
  permission: 'emails.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.EmailMessageWhereInput = {
      ...(q.search
        ? {
            OR: [
              { toEmail: { contains: q.search, mode: 'insensitive' } },
              { subject: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.status && q.status !== 'all' ? { status: q.status as never } : {}),
    };

    const [rows, total] = await Promise.all([
      db.emailMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          kind: true,
          toEmail: true,
          toName: true,
          subject: true,
          status: true,
          error: true,
          sentAt: true,
          createdAt: true,
          enquiry: { select: { id: true, reference: true } },
        },
      }),
      db.emailMessage.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});
