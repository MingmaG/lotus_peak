import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';

/**
 * Enquiries.
 *
 * Personal data, so the permission is `enquiries.read` and the Editor role
 * does not have it. Content and personal data are different jobs, and the
 * person who writes the journal has no business reading who wrote in.
 */
export const GET = route({
  permission: 'enquiries.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.EnquiryWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { reference: { contains: q.search, mode: 'insensitive' } },
              { message: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.status && q.status !== 'all' ? { status: q.status as never } : {}),
      ...(searchParams.get('assignee') && searchParams.get('assignee') !== 'all'
        ? searchParams.get('assignee') === 'nobody'
          ? { assigneeId: null }
          : { assigneeId: searchParams.get('assignee') }
        : {}),
      ...(searchParams.get('trip') && searchParams.get('trip') !== 'all'
        ? { tripId: searchParams.get('trip') }
        : {}),
    };

    const [rows, total, counts] = await Promise.all([
      db.enquiry.findMany({
        where,
        orderBy: { createdAt: q.direction },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          trip: { select: { id: true, title: true } },
          assignee: { select: { id: true, name: true } },
          _count: { select: { notes: true, messages: true } },
        },
      }),
      db.enquiry.count({ where }),
      /* The counts beside the status filter, so somebody can see there are
         four unread without changing the filter to find out. */
      db.enquiry.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    return {
      ...paginated(rows, total, q),
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
    };
  },
});
