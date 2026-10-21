import { DepartureEditor } from '@/components/crm/departure-editor';
import { blankDeparture } from '@/components/crm/departure-form';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'New · Departures' };
export const dynamic = 'force-dynamic';

export default async function NewDeparturePage() {
  await requirePermission('departures.read');
  const [canWrite, trips] = await Promise.all([
    hasPermission('departures.write'),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <DepartureEditor
      initial={blankDeparture(trips[0]?.id ?? '')}
      trips={trips}
      canWrite={canWrite}
      canDelete={false}
    />
  );
}
