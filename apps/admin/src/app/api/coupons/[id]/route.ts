import { db } from '@/lib/db';
import { conflict, notFound, route } from '@/lib/api/handler';
import { couponUpdateSchema, type CouponInput } from '@/server/validators/coupon';
import { date } from '@/server/services/booking';

export const PATCH = route<CouponInput, { id: string }>({
  permission: 'coupons.write',
  schema: couponUpdateSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.coupon.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!before) throw notFound('That coupon');

    const coupon = await db.$transaction(async (tx) => {
      /* The journey list is replaced, not merged: it is edited as a set of
         tick boxes and "everything that is ticked" is the whole statement. */
      await tx.couponOnTrip.deleteMany({ where: { couponId: params.id } });

      return tx.coupon.update({
        where: { id: params.id },
        data: {
          code: body.code,
          description: body.description || null,
          kind: body.kind,
          value: body.value,
          currency: body.currency,
          minSpendCents: body.minSpendCents ?? null,
          maxDiscountCents: body.maxDiscountCents ?? null,
          startsAt: date(body.startsAt),
          endsAt: date(body.endsAt),
          maxRedemptions: body.maxRedemptions ?? null,
          maxPerCustomer: body.maxPerCustomer ?? null,
          isActive: body.isActive,
          trips: { create: body.tripIds.map((tripId) => ({ tripId })) },
        },
        include: {
          trips: { select: { tripId: true, trip: { select: { title: true } } } },
          _count: { select: { redemptions: true } },
        },
      });
    });

    audit({
      action: 'UPDATE',
      entity: 'coupon',
      entityId: coupon.id,
      entityLabel: coupon.code,
      before: { value: before.value, isActive: before.isActive },
      after: { value: coupon.value, isActive: coupon.isActive },
    });

    return { coupon };
  },
});

/**
 * Removed, unless somebody has used it.
 *
 * A coupon that has been redeemed is part of an invoice — the booking names
 * the code it was given, and deleting the row underneath leaves a discount on
 * a bill that can no longer be explained. Switching it off is what somebody
 * wants in that case, and the message says so rather than making them guess.
 */
export const DELETE = route<undefined, { id: string }>({
  permission: 'coupons.delete',
  handler: async ({ params, audit }) => {
    const coupon = await db.coupon.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!coupon) throw notFound('That coupon');

    if (coupon._count.redemptions > 0) {
      throw conflict(
        'This coupon has been used on a booking. Switch it off instead, so the discount on that invoice still has a name.',
      );
    }

    await db.coupon.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    audit({
      action: 'DELETE',
      entity: 'coupon',
      entityId: coupon.id,
      entityLabel: coupon.code,
    });
    return null;
  },
});
