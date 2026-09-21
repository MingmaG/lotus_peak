import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';

const schema = z
  .object({
    tripId: z.string().min(1, 'Which journey?'),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    priceUsd: z.number().int().min(0).max(1_000_000),
    placesTotal: z.number().int().min(1).max(60).nullable().optional(),
    placesLeft: z.number().int().min(0).max(60).nullable().optional(),
    status: z
      .enum(['OPEN', 'GUARANTEED', 'FEW_PLACES', 'CLOSED', 'CANCELLED'])
      .default('OPEN'),
    note: z.string().max(300).nullable().optional(),
    /**
     * A fixed departure runs on this date whoever books it.
     *
     * The rest are "we will find a date together", which is how most of these
     * journeys are actually sold — so the site lists the fixed ones as a
     * calendar and leaves the others as an invitation to write.
     */
    isFixed: z.boolean().default(false),
    /** Struck through beside the price, for an early-booking rate. */
    wasPriceUsd: z.number().int().min(0).max(1_000_000).nullable().optional(),
    isPublished: z.boolean().default(true),
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    message: 'It has to end after it starts.',
    path: ['endDate'],
  })
  .refine(
    (value) =>
      value.placesTotal == null ||
      value.placesLeft == null ||
      value.placesLeft <= value.placesTotal,
    { message: 'There cannot be more places left than there are places.', path: ['placesLeft'] },
  );

export const GET = route({
  permission: 'departures.read',
  handler: async ({ searchParams }) => {
    /**
     * Future departures by default.
     *
     * A list that opens on 2019 is a list somebody has to scroll past every
     * time. `?past=1` is there for the rare look back.
     */
    const past = searchParams.get('past') === '1';

    return {
      items: await db.departure.findMany({
        where: past
          ? { startDate: { lt: new Date() } }
          : { startDate: { gte: new Date() } },
        orderBy: { startDate: past ? 'desc' : 'asc' },
        take: 200,
        include: { trip: { select: { id: true, title: true, slug: true } } },
      }),
    };
  },
});

export const POST = route<z.infer<typeof schema>>({
  permission: 'departures.write',
  schema,
  handler: async ({ body, audit }) => {
    const row = await db.departure.create({
      data: {
        tripId: body.tripId,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        priceUsd: body.priceUsd,
        placesTotal: body.placesTotal ?? null,
        placesLeft: body.placesLeft ?? null,
        status: body.status,
        note: body.note || null,
        isFixed: body.isFixed,
        wasPriceUsd: body.wasPriceUsd ?? null,
        isPublished: body.isPublished,
      },
      include: { trip: { select: { slug: true, title: true } } },
    });

    audit({
      action: 'CREATE',
      entity: 'departure',
      entityId: row.id,
      entityLabel: `${row.trip.title} — ${body.startDate.slice(0, 10)}`,
    });
    void revalidateFor('departure', [`/trips/${row.trip.slug}`]);
    return { departure: row };
  },
});
