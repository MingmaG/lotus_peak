import 'server-only';

import { db } from '@/lib/db';
import type { EditorOptions } from '@/components/bookings/booking-editor';

/**
 * What the booking form needs in its dropdowns.
 *
 * One function rather than a query in each of the two pages that render the
 * editor, because a journey added to the list on one and not the other is a
 * form that behaves differently depending on how you reached it.
 *
 * Departures are loaded whole rather than fetched per journey as somebody
 * picks one. There are a few dozen of them at most, the form filters the list
 * client-side, and a request between choosing a journey and choosing a date is
 * a pause in the middle of a telephone call.
 */
export async function bookingEditorOptions(): Promise<EditorOptions> {
  const [trips, departures, users] = await Promise.all([
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, priceFromUsd: true },
    }),
    db.departure.findMany({
      /* Past departures are left out: a booking cannot be taken on a date that
         has gone, and a list that opens on 2019 is a list to scroll past. An
         existing booking on an old departure still shows its dates, which are
         copied onto the booking itself. */
      where: { startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
      take: 200,
      select: {
        id: true,
        tripId: true,
        startDate: true,
        endDate: true,
        priceUsd: true,
        placesLeft: true,
        placesTotal: true,
      },
    }),
    db.user.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return {
    trips,
    departures: departures.map((one) => ({
      ...one,
      startDate: one.startDate.toISOString(),
      endDate: one.endDate.toISOString(),
    })),
    users,
  };
}
