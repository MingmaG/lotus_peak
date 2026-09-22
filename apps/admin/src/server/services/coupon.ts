import 'server-only';

import type { Coupon, Prisma } from '@prisma/client';

import { db } from '@/lib/db';

/**
 * Whether a code may be used, and what it takes off.
 *
 * One function, called from three places — the Coupons screen's try-it box,
 * the booking form as somebody types a code, and the save that actually
 * applies it. That last one is the reason this is not a client-side
 * calculation: a discount decided in the browser is a discount anybody can
 * decide.
 *
 * It returns a reason rather than throwing, because every caller wants to show
 * the reason. "That code has run out" is a useful sentence; a 422 with
 * `INVALID` in it is not.
 */

export interface CouponVerdict {
  ok: boolean;
  /** Why not, in words the office can read out. */
  reason?: string;
  coupon?: Coupon;
  discountCents: number;
}

export interface CouponQuery {
  code: string;
  subtotalCents: number;
  tripId?: string | null;
  customerId?: string | null;
  /**
   * The booking the code is being applied to, if it already exists.
   *
   * Excluded from the per-customer count, so that re-saving a booking that
   * already holds this coupon is not counted as a second use. Without it,
   * editing a traveller's dietary requirement would eventually exhaust their
   * own coupon.
   */
  bookingId?: string | null;
}

export async function evaluateCoupon(
  query: CouponQuery,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<CouponVerdict> {
  const code = query.code.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Type a code.', discountCents: 0 };

  const coupon = await client.coupon.findFirst({
    where: { code, deletedAt: null },
    include: { trips: { select: { tripId: true } } },
  });

  if (!coupon) return { ok: false, reason: 'No coupon has that code.', discountCents: 0 };
  if (!coupon.isActive) {
    return { ok: false, reason: 'That coupon has been switched off.', discountCents: 0 };
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, reason: 'That coupon has not started yet.', discountCents: 0 };
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    return { ok: false, reason: 'That coupon has expired.', discountCents: 0 };
  }

  if (coupon.maxRedemptions != null && coupon.redeemedCount >= coupon.maxRedemptions) {
    return { ok: false, reason: 'That coupon has been used up.', discountCents: 0 };
  }

  /* An empty trip list means every journey — the commonest case, and the one
     that would need a row per journey if this were a required join. */
  if (coupon.trips.length > 0) {
    if (!query.tripId || !coupon.trips.some((one) => one.tripId === query.tripId)) {
      return {
        ok: false,
        reason: 'That coupon does not apply to this journey.',
        discountCents: 0,
      };
    }
  }

  if (coupon.minSpendCents != null && query.subtotalCents < coupon.minSpendCents) {
    return {
      ok: false,
      reason: `That coupon needs a total of at least ${(coupon.minSpendCents / 100).toFixed(2)}.`,
      discountCents: 0,
    };
  }

  if (coupon.maxPerCustomer != null && query.customerId) {
    const used = await client.couponRedemption.count({
      where: {
        couponId: coupon.id,
        customerId: query.customerId,
        ...(query.bookingId ? { bookingId: { not: query.bookingId } } : {}),
      },
    });
    if (used >= coupon.maxPerCustomer) {
      return {
        ok: false,
        reason: 'This customer has already used that coupon as often as they may.',
        discountCents: 0,
      };
    }
  }

  return { ok: true, coupon, discountCents: discountFor(coupon, query.subtotalCents) };
}

/**
 * What the coupon takes off a given subtotal.
 *
 * Rounded down, not to nearest. A discount that rounds up gives away a cent
 * that has to come from somewhere, and across a season of bookings the
 * somewhere is a reconciliation nobody can close.
 *
 * Never more than the subtotal: a fixed $500 off a $300 extra is $300 off, not
 * a booking that owes the traveller money. A refund is a payment row, and it
 * is entered by a person.
 */
export function discountFor(
  coupon: Pick<Coupon, 'kind' | 'value' | 'maxDiscountCents'>,
  subtotalCents: number,
): number {
  const raw =
    coupon.kind === 'PERCENTAGE'
      ? Math.floor((subtotalCents * coupon.value) / 100)
      : coupon.value;

  const capped =
    coupon.maxDiscountCents != null ? Math.min(raw, coupon.maxDiscountCents) : raw;

  return Math.max(0, Math.min(capped, subtotalCents));
}
