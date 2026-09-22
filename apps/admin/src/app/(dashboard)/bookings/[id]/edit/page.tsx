import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { bookingEditorOptions } from '@/server/services/booking-options';
import { EditBooking } from './edit-booking';

export const metadata = { title: 'Edit a booking' };
export const dynamic = 'force-dynamic';

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('bookings.write');
  const { id } = await params;

  const [booking, options] = await Promise.all([
    db.booking.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, country: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        travellers: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    bookingEditorOptions(),
  ]);
  if (!booking) notFound();

  return (
    <>
      <PageHeader
        title={`Booking ${booking.reference}`}
        description="The bill is saved whole — lines, coupon and total together — so the figure on the screen is never briefly wrong."
      />
      <EditBooking
        booking={JSON.parse(JSON.stringify(booking))}
        options={options}
      />
    </>
  );
}
