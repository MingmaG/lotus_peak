import { CouponEditor } from '@/components/bookings/coupon-editor';
import { blankCoupon } from '@/components/bookings/coupon-form';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'New coupon' };
export const dynamic = 'force-dynamic';

export default async function NewCouponPage() {
  await requirePermission('coupons.write');

  const trips = await db.trip.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true },
  });

  return <CouponEditor initial={blankCoupon()} trips={trips} canWrite canDelete={false} />;
}
