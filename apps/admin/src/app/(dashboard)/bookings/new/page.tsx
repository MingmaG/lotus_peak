import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { bookingEditorOptions } from '@/server/services/booking-options';
import { NewBooking } from './new-booking';

export const metadata = { title: 'Take a booking' };
export const dynamic = 'force-dynamic';

/**
 * The blank booking form.
 *
 * `?customer=` and `?enquiry=` pre-fill it, because both screens that link here
 * do so from a record that already answers the form's first question. Arriving
 * from Ana Rivas's page and having to search for Ana Rivas is the kind of small
 * insult that makes a panel feel like paperwork.
 *
 * Resolved here rather than fetched by the client: the customer is looked up
 * behind the same permission check as the rest of the page, and a form that
 * renders empty and then fills itself in is a form somebody starts typing into
 * twice.
 */
export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; enquiry?: string }>;
}) {
  await requirePermission('bookings.write');
  const { customer: customerId, enquiry: enquiryId } = await searchParams;

  const [options, customer, enquiry] = await Promise.all([
    bookingEditorOptions(),
    customerId
      ? db.customer.findFirst({
          where: { id: customerId, deletedAt: null },
          select: { id: true, name: true, email: true, phone: true, country: true },
        })
      : Promise.resolve(null),
    enquiryId
      ? db.enquiry.findFirst({
          where: { id: enquiryId, deletedAt: null },
          select: {
            id: true,
            tripId: true,
            adults: true,
            children: true,
            source: true,
            message: true,
            customer: {
              select: { id: true, name: true, email: true, phone: true, country: true },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Take a booking"
        description="Nothing is sent to anybody. A booking starts as a draft and becomes real when you say so."
      />
      <NewBooking
        options={options}
        /* The enquiry's own customer wins when both are given: arriving from an
           enquiry means booking for whoever wrote it. */
        customer={enquiry?.customer ?? customer}
        enquiry={enquiry}
      />
    </>
  );
}
