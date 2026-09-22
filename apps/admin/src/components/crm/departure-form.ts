/*
 * The editable shape and its empty starting value, kept out of the editor's
 * 'use client' module on purpose: the `new` route is a Server Component and
 * calls the blank factory. A function exported from a client module is only a
 * reference on the server, and calling it there throws.
 */

export interface DepartureForm {
  id: string | null;
  tripId: string;
  startDate: string;
  endDate: string;
  priceUsd: number;
  placesTotal: string;
  placesLeft: string;
  status: string;
  note: string;
  isFixed: boolean;
  wasPriceUsd: string;
  isPublished: boolean;
}

/** Three months out, ten days long — a starting point, not a guess at the answer. */
export function blankDeparture(tripId: string): DepartureForm {
  const start = new Date();
  start.setMonth(start.getMonth() + 3);
  const end = new Date(start);
  end.setDate(end.getDate() + 10);
  return {
    id: null,
    tripId,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    priceUsd: 0,
    placesTotal: '',
    placesLeft: '',
    status: 'OPEN',
    note: '',
    isFixed: false,
    wasPriceUsd: '',
    isPublished: true,
  };
}
