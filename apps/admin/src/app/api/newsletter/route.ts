import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';

export const GET = route({
  permission: 'newsletter.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.NewsletterSubscriberWhereInput = {
      ...(q.search ? { email: { contains: q.search, mode: 'insensitive' } } : {}),
      ...(q.status && q.status !== 'all' ? { status: q.status as never } : {}),
    };

    const [rows, total, counts] = await Promise.all([
      db.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      db.newsletterSubscriber.count({ where }),
      db.newsletterSubscriber.groupBy({ by: ['status'], _count: true }),
    ]);

    return {
      ...paginated(rows, total, q),
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
    };
  },
});

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED']),
});

export const PATCH = route<z.infer<typeof patchSchema>>({
  permission: 'newsletter.write',
  schema: patchSchema,
  handler: async ({ body, audit }) => {
    const row = await db.newsletterSubscriber.update({
      where: { id: body.id },
      data: {
        status: body.status,
        unsubscribedAt: body.status === 'UNSUBSCRIBED' ? new Date() : undefined,
        confirmedAt: body.status === 'SUBSCRIBED' ? new Date() : undefined,
      },
    });

    audit({
      action: 'UPDATE',
      entity: 'newsletter',
      entityId: row.id,
      entityLabel: row.email,
      after: { status: body.status },
    });
    return { subscriber: row };
  },
});
