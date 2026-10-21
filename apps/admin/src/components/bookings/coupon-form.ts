/*
 * The editable shape and its empty starting value, kept out of the editor's
 * 'use client' module on purpose: the `new` route is a Server Component and
 * calls the blank factory. A function exported from a client module is only a
 * reference on the server, and calling it there throws.
 */

/** The editable shape of a coupon. Numbers the office may leave empty stay strings. */
export interface CouponForm {
  id: string | null;
  code: string;
  description: string;
  kind: string;
  percentage: number;
  amountCents: number;
  minSpendCents: number;
  maxDiscountCents: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  maxPerCustomer: string;
  tripIds: string[];
  isActive: boolean;
}

export function blankCoupon(): CouponForm {
  return {
    id: null,
    code: '',
    description: '',
    kind: 'PERCENTAGE',
    percentage: 10,
    amountCents: 0,
    minSpendCents: 0,
    maxDiscountCents: 0,
    startsAt: '',
    endsAt: '',
    maxRedemptions: '',
    maxPerCustomer: '',
    tripIds: [],
    isActive: true,
  };
}
