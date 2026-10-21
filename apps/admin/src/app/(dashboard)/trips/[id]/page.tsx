import { notFound } from 'next/navigation';

import { TripEditor } from '@/components/treks/trip-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { tripFormData, tripLinkOptions } from '@/server/services/trip-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await db.trip.findUnique({ where: { id }, select: { title: true } });
  return { title: trip?.title ?? 'Journey' };
}

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('trips.read');
  const { id } = await params;

  const [trip, destinations, otherTrips, { culture, posts }, company] = await Promise.all([
    tripFormData(id),
    db.destination.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    db.trip.findMany({
      where: { deletedAt: null, id: { not: id } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
    tripLinkOptions(),
    db.companyProfile.findFirst({ select: { siteUrl: true } }),
  ]);

  if (!trip) notFound();

  return (
    <TripEditor
      initial={trip}
      destinations={destinations}
      otherTrips={otherTrips}
      culture={culture}
      posts={posts}
      siteUrl={company?.siteUrl ?? 'https://lotuspeak.org'}
      canPublish={can(user.permissions, 'trips.publish')}
    />
  );
}
