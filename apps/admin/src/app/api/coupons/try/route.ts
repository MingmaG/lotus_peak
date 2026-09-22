import { z } from 'zod';

import { route } from '@/lib/api/handler';
import { couponTrySchema } from '@/server/validators/coupon';
import { evaluateCoupon } from '@/server/services/coupon';

/**
 * Trying a code before committing to it.
 *
 * The booking form calls this as somebody types, so the discount appears in
 * the total before they save rather than after. It is the same
 * `evaluateCoupon` the save runs, which is the point — a preview computed by
 * different code from the one that applies it is a preview that will
 * eventually disagree with the invoice.
 *
 * `coupons.read` rather than `bookings.write`: it reads a coupon and changes
 * nothing. Nothing is redeemed until the booking is saved.
 */
export const POST = route<z.infer<typeof couponTrySchema>>({
  permission: 'coupons.read',
  schema: couponTrySchema,
  handler: async ({ body }) => {
    const verdict = await evaluateCoupon({
      code: body.code,
      subtotalCents: body.subtotalCents,
      tripId: body.tripId ?? null,
      customerId: body.customerId ?? null,
      bookingId: body.bookingId ?? null,
    });

    return {
      ok: verdict.ok,
      reason: verdict.reason ?? null,
      discountCents: verdict.discountCents,
      coupon: verdict.coupon
        ? {
            id: verdict.coupon.id,
            code: verdict.coupon.code,
            kind: verdict.coupon.kind,
            value: verdict.coupon.value,
            description: verdict.coupon.description,
          }
        : null,
    };
  },
});
