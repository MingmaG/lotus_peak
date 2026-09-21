import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Bookings' };
export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  await requirePermission('bookings.read');

  return (
    <NotBuiltYet
      title="Bookings"
      description="A journey somebody has actually committed to, and everything that follows from it."
      willHold={[
        "Who is coming, on which departure, and what they have paid",
        "The itinerary as confirmed, which can differ from the published one",
        "Permits, visas and the paperwork Bhutan asks for before arrival",
        "A note trail, so anybody in the office can pick up a conversation"
]}
      needs="A Booking table, and a decision about whether a booking is created here or by the traveller on the website."
    />
  );
}
