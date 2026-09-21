import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';

const patchSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  priceUsd: z.number().int().min(0).optional(),
  placesTotal: z.number().int().min(0).nullable().optional(),
  placesLeft: z.number().int().min(0).nullable().optional(),
  status: z.enum(['OPEN', 'GUARANTEED', 'FEW_PLACES', 'CLOSED', 'CANCELLED']).optional(),
  note: z.string().max(300).nullable().optional(),
  /** A fixed departure runs on this date whoever books it. */
  isFixed: z.boolean().optional(),
  /** Struck through beside the price, for an early-booking rate. */
  wasPriceUsd: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'departures.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const row = await db.departure.update({
      where: { id: params.id },
      data: {
        ...(body.startDate ? { startDate: new Date(body.startDate) } : {}),
        ...(body.endDate ? { endDate: new Date(body.endDate) } : {}),
        priceUsd: body.priceUsd,
        placesTotal: body.placesTotal,
        placesLeft: body.placesLeft,
        status: body.status,
        note: body.note === undefined ? undefined : body.note || null,
        isFixed: body.isFixed,
        wasPriceUsd: body.wasPriceUsd === undefined ? undefined : body.wasPriceUsd,
        isPublished: body.isPublished,
      },
      include: { trip: { select: { slug: true, title: true } } },
    });

    audit({
      action: 'UPDATE',
      entity: 'departure',
      entityId: row.id,
      entityLabel: `${row.trip.title} — ${row.startDate.toISOString().slice(0, 10)}`,
    });
    return { departure: row, revalidated: await revalidateFor('departure', [`/trips/${row.trip.slug}`]) };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'departures.delete',
  handler: async ({ params, audit }) => {
    const row = await db.departure.findUnique({
      where: { id: params.id },
      include: { trip: { select: { slug: true, title: true } } },
    });
    if (!row) throw notFound('That departure');

    await db.departure.delete({ where: { id: params.id } });

    audit({
      action: 'DELETE',
      entity: 'departure',
      entityId: row.id,
      entityLabel: `${row.trip.title} — ${row.startDate.toISOString().slice(0, 10)}`,
    });
    void revalidateFor('departure', [`/trips/${row.trip.slug}`]);
    return null;
  },
});
