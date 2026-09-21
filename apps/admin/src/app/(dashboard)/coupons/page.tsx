import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Coupons' };
export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  await requirePermission('coupons.read');

  return (
    <NotBuiltYet
      title="Coupons"
      description="Discounts, and the rules about who may use them."
      willHold={[
        "A code, what it takes off, and when it stops working",
        "Which journeys it applies to",
        "How many times it has been used, and by whom"
]}
      needs="A Coupon table, and bookings to apply one to."
    />
  );
}
