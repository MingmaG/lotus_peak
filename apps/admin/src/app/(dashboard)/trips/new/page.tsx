import { TripEditor } from '@/components/treks/trip-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { emptyTripForm, tripLinkOptions } from '@/server/services/trip-form';

export const metadata = { title: 'New journey' };
export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const user = await requirePermission('trips.write');

  const [destinations, otherTrips, { culture, posts }, company] = await Promise.all([
    db.destination.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
    tripLinkOptions(),
    db.companyProfile.findFirst({ select: { siteUrl: true } }),
  ]);

  return (
    <TripEditor
      initial={emptyTripForm()}
      destinations={destinations}
      otherTrips={otherTrips}
      culture={culture}
      posts={posts}
      siteUrl={company?.siteUrl ?? 'https://lotuspeak.org'}
      canPublish={can(user.permissions, 'trips.publish')}
    />
  );
}
