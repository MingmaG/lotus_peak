import { notFound } from 'next/navigation';

import { CouponEditor } from '@/components/bookings/coupon-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coupon = await db.coupon.findFirst({
    where: { id, deletedAt: null },
    select: { code: true },
  });
  return { title: coupon?.code ?? 'Coupon' };
}

export default async function CouponPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('coupons.read');
  const { id } = await params;

  const [coupon, trips] = await Promise.all([
    db.coupon.findFirst({
      where: { id, deletedAt: null },
      include: { trips: { select: { tripId: true } } },
    }),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
  ]);
  if (!coupon) notFound();

  return (
    <CouponEditor
      initial={{
        id: coupon.id,
        code: coupon.code,
        description: coupon.description ?? '',
        kind: coupon.kind,
        /* `value` is a percentage or cents depending on `kind`; the other
           field keeps a sensible starting point in case the kind is switched. */
        percentage: coupon.kind === 'PERCENTAGE' ? coupon.value : 10,
        amountCents: coupon.kind === 'FIXED_AMOUNT' ? coupon.value : 0,
        minSpendCents: coupon.minSpendCents ?? 0,
        maxDiscountCents: coupon.maxDiscountCents ?? 0,
        startsAt: coupon.startsAt?.toISOString().slice(0, 10) ?? '',
        endsAt: coupon.endsAt?.toISOString().slice(0, 10) ?? '',
        maxRedemptions: coupon.maxRedemptions?.toString() ?? '',
        maxPerCustomer: coupon.maxPerCustomer?.toString() ?? '',
        tripIds: coupon.trips.map((one) => one.tripId),
        isActive: coupon.isActive,
      }}
      trips={trips}
      canWrite={can(user.permissions, 'coupons.write')}
      canDelete={can(user.permissions, 'coupons.delete')}
    />
  );
}
