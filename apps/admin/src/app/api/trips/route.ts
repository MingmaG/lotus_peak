import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { createTrip } from '@/server/services/trip';
import { revalidateFor } from '@/server/services/revalidate';
import { tripPatchSchema } from '@/server/validators/trip';

export const GET = route({
  permission: 'trips.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);
    const includeDeleted = searchParams.get('deleted') === '1';

    const where: Prisma.TripWhereInput = {
      deletedAt: includeDeleted ? { not: null } : null,
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { slug: { contains: q.search, mode: 'insensitive' } },
              { excerpt: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.status && q.status !== 'all'
        ? { status: q.status as Prisma.EnumContentStatusFilter['equals'] }
        : {}),
      ...(searchParams.get('type') && searchParams.get('type') !== 'all'
        ? { type: searchParams.get('type') as never }
        : {}),
    };

    const orderBy: Prisma.TripOrderByWithRelationInput =
      q.sort === 'title'
        ? { title: q.direction }
        : q.sort === 'price'
          ? { priceFromUsd: q.direction }
          : q.sort === 'duration'
            ? { durationDays: q.direction }
            : q.sort === 'order'
              ? { sortOrder: q.direction }
              : { updatedAt: q.direction };

    const [rows, total] = await Promise.all([
      db.trip.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          status: true,
          difficulty: true,
          durationDays: true,
          priceFromUsd: true,
          featured: true,
          sortOrder: true,
          updatedAt: true,
          publishedAt: true,
          regions: true,
          _count: { select: { itinerary: true, departures: true, enquiries: true } },
        },
      }),
      db.trip.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});

const createSchema = tripPatchSchema.extend({
  title: z.string().min(1, 'Give the journey a title.').max(200),
});

export const POST = route<z.infer<typeof createSchema>>({
  permission: 'trips.write',
  schema: createSchema,
  handler: async ({ body, audit }) => {
    const trip = await createTrip(body);

    audit({
      action: 'CREATE',
      entity: 'trip',
      entityId: trip.id,
      entityLabel: trip.title,
    });

    /* A draft changes nothing on the website, so nothing is pushed. The first
       publish is what the site needs to hear about. */
    if (trip.status === 'PUBLISHED') void revalidateFor('trip', [`/trips/${trip.slug}`]);

    return { trip };
  },
});
