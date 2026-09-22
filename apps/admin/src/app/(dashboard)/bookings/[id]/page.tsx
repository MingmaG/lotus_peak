import { notFound } from 'next/navigation';

import { BookingDetail, type BookingDetailData } from '@/components/bookings/booking-detail';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { bookingInclude } from '@/server/services/booking';

export const metadata = { title: 'Booking' };
export const dynamic = 'force-dynamic';

/**
 * One booking, rendered on the server and kept fresh on the client.
 *
 * Loaded here rather than fetched by the component so the passport numbers and
 * the payment history are behind `requirePermission` before a single byte is
 * sent — a client fetch would be checked too, but only after the shell of the
 * page had already rendered for somebody who may not read it.
 */
export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission('bookings.read');
  const { id } = await params;

  const booking = await db.booking.findFirst({
    where: { id, deletedAt: null },
    include: bookingInclude,
  });
  if (!booking) notFound();

  return (
    <BookingDetail
      /* Dates come back as `Date` from Prisma and as strings from the API the
         client refetches with. Serialised here so the two shapes agree — a
         component that has to handle both is a component with a `typeof` in
         every date cell. */
      booking={JSON.parse(JSON.stringify(booking)) as BookingDetailData}
      canWrite={can(user.permissions, 'bookings.write')}
      canDelete={can(user.permissions, 'bookings.delete')}
      canTakePayments={can(user.permissions, 'payments.write')}
    />
  );
}
