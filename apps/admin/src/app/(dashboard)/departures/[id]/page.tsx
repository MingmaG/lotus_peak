import { notFound } from 'next/navigation';

import { DepartureEditor } from '@/components/crm/departure-editor';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Departure' };
export const dynamic = 'force-dynamic';

export default async function DeparturePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('departures.read');
  const { id } = await params;

  const [row, canWrite, canDelete, trips] = await Promise.all([
    db.departure.findUnique({ where: { id } }),
    hasPermission('departures.write'),
    hasPermission('departures.delete'),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
  ]);
  if (!row) notFound();

  return (
    <DepartureEditor
      initial={{
        id: row.id,
        tripId: row.tripId,
        /* The date inputs want `YYYY-MM-DD`, read in UTC as the sheet read it. */
        startDate: row.startDate.toISOString().slice(0, 10),
        endDate: row.endDate.toISOString().slice(0, 10),
        priceUsd: row.priceUsd,
        placesTotal: row.placesTotal?.toString() ?? '',
        placesLeft: row.placesLeft?.toString() ?? '',
        status: row.status,
        note: row.note ?? '',
        isFixed: row.isFixed,
        wasPriceUsd: row.wasPriceUsd?.toString() ?? '',
        isPublished: row.isPublished,
      }}
      trips={trips}
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
