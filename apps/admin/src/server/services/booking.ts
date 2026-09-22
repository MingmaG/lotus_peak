import 'server-only';

import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { bookingReference } from '@/lib/reference';
import { ApiError, conflict } from '@/lib/api/handler';
import type { BookingInput } from '@/server/validators/booking';
import { evaluateCoupon } from './coupon';

/**
 * Everything that decides what a booking costs and what it is owed.
 *
 * The route handlers below this are thin on purpose. A booking's total is
 * arrived at in four steps that have to happen together and in order — lines,
 * coupon, total, then the payments against it — and spreading them across a
 * POST and a PATCH means two places where step three can be forgotten. It has
 * been, in the shape of a booking that showed a discount on its detail screen
 * and the undiscounted figure in the list.
 *
 * Every function here takes a transaction client, because none of them is
 * correct on its own: writing the lines without recomputing the total leaves a
 * row that disagrees with itself, and a reader between the two sees it.
 */

type Tx = Prisma.TransactionClient;

/* -------------------------------------------------------------------------- */
/*  The reference                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `LP-B-7QK4`, and not one that is already taken.
 *
 * Five attempts, then give up rather than loop. A million codes and a handful
 * of bookings means a collision is vanishingly unlikely; a loop that cannot
 * end is how a vanishingly unlikely thing becomes an outage.
 */
export async function nextBookingReference(client: Tx | typeof db = db): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = bookingReference();
    const taken = await client.booking.findUnique({
      where: { reference },
      select: { id: true },
    });
    if (!taken) return reference;
  }
  throw new ApiError(
    500,
    'REFERENCE_EXHAUSTED',
    'Could not allocate a booking reference. Try again.',
  );
}

/* -------------------------------------------------------------------------- */
/*  The bill                                                                   */
/* -------------------------------------------------------------------------- */

export interface PricedItem {
  kind: 'JOURNEY' | 'SUPPLEMENT' | 'EXTRA' | 'PERMIT' | 'FEE' | 'DISCOUNT' | 'OTHER';
  label: string;
  detail: string | null;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  sortOrder: number;
}

/**
 * The lines, priced.
 *
 * `amountCents` is computed here and never accepted from the client — see the
 * note at the top of `validators/booking.ts`.
 *
 * When no lines are sent but a per-head price is, one journey line is made
 * from the party size. That is the booking the office takes most often — a
 * price per person and a number of people — and making them type the line by
 * hand to express it would be a form that is longer than the conversation.
 */
export function priceItems(input: BookingInput): PricedItem[] {
  const party = input.adults + input.children;

  const lines =
    input.items.length > 0
      ? input.items
      : input.pricePerPersonCents > 0
        ? [
            {
              kind: 'JOURNEY' as const,
              label: 'The journey',
              detail: null,
              quantity: party,
              unitPriceCents: input.pricePerPersonCents,
            },
          ]
        : [];

  return lines.map((item, index) => ({
    kind: item.kind,
    label: item.label,
    detail: item.detail ?? null,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    amountCents: item.quantity * item.unitPriceCents,
    sortOrder: index,
  }));
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Subtotal, discount, total.
 *
 * A `DISCOUNT` line holds a **positive** amount and is subtracted, for the same
 * reason a refund is a direction rather than a negative payment: a table where
 * some amounts are negative is a table where every `SUM` depends on somebody
 * having remembered the sign, and the first one that forgets produces a total
 * that is wrong by twice the discount.
 *
 * The total floors at zero. Lines and a coupon that between them come to more
 * than the journey costs is an office mistake, and a negative total would turn
 * it into a balance the traveller is owed — which is a refund, and a refund is
 * a payment somebody enters deliberately.
 */
export function totalsFor(items: PricedItem[], couponDiscountCents: number): Totals {
  let subtotalCents = 0;
  let lineDiscountCents = 0;

  for (const item of items) {
    if (item.kind === 'DISCOUNT') lineDiscountCents += item.amountCents;
    else subtotalCents += item.amountCents;
  }

  const discountCents = Math.min(subtotalCents, lineDiscountCents + couponDiscountCents);

  return {
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
  };
}

/* -------------------------------------------------------------------------- */
/*  The coupon                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Applies, moves or removes the coupon on a booking, and keeps the count true.
 *
 * `redeemedCount` is a column rather than a `_count`, so it has to be moved by
 * hand — which is what this does, in the same transaction as the redemption
 * row. The alternative, counting the rows on read, lets two bookings saved at
 * the same moment both take the last redemption of a coupon limited to one.
 *
 * Returns what the coupon took off, for the caller to store on the booking.
 */
export async function applyCoupon(
  tx: Tx,
  booking: { id: string; customerId: string; tripId: string | null },
  code: string | null | undefined,
  subtotalCents: number,
): Promise<{ couponId: string | null; couponCode: string | null; discountCents: number }> {
  const existing = await tx.couponRedemption.findUnique({
    where: { bookingId: booking.id },
  });

  const wanted = code?.trim().toUpperCase() || null;

  /* Cleared, or replaced by a different code: give the old one its redemption
     back before taking the new one, or a coupon limited to fifty is exhausted
     by twenty bookings that changed their minds. */
  if (existing) {
    const previous = await tx.coupon.findUnique({
      where: { id: existing.couponId },
      select: { code: true },
    });
    if (!wanted || previous?.code !== wanted) {
      await tx.couponRedemption.delete({ where: { bookingId: booking.id } });
      await tx.coupon.update({
        where: { id: existing.couponId },
        data: { redeemedCount: { decrement: 1 } },
      });
    }
  }

  if (!wanted) return { couponId: null, couponCode: null, discountCents: 0 };

  const verdict = await evaluateCoupon(
    {
      code: wanted,
      subtotalCents,
      tripId: booking.tripId,
      customerId: booking.customerId,
      bookingId: booking.id,
    },
    tx,
  );

  if (!verdict.ok || !verdict.coupon) {
    /* A 422 keyed to the field, so the form puts the sentence beside the code
       box rather than in a toast that covers it. */
    throw new ApiError(422, 'VALIDATION_FAILED', 'That coupon cannot be used.', {
      couponCode: verdict.reason ?? 'That coupon cannot be used.',
    });
  }

  const already = await tx.couponRedemption.findUnique({ where: { bookingId: booking.id } });
  if (already) {
    /* Same code, same booking — the subtotal may have moved, so the recorded
       amount is refreshed without touching the count. */
    await tx.couponRedemption.update({
      where: { bookingId: booking.id },
      data: { amountCents: verdict.discountCents },
    });
  } else {
    await tx.couponRedemption.create({
      data: {
        couponId: verdict.coupon.id,
        bookingId: booking.id,
        customerId: booking.customerId,
        amountCents: verdict.discountCents,
      },
    });
    await tx.coupon.update({
      where: { id: verdict.coupon.id },
      data: { redeemedCount: { increment: 1 } },
    });
  }

  return {
    couponId: verdict.coupon.id,
    couponCode: verdict.coupon.code,
    discountCents: verdict.discountCents,
  };
}

/* -------------------------------------------------------------------------- */
/*  What has been paid                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Re-adds the payments and writes the result onto the booking.
 *
 * Only `COMPLETED` rows count. A pending bank transfer is money the office
 * expects and has not got, and a balance screen that counted it would send a
 * traveller to Bhutan on the strength of a transfer that bounced.
 *
 * Fees are not subtracted: the booking is paid when the traveller sent the
 * full amount, not when the office received it net of the bank's cut. The fee
 * is recorded so the difference is visible rather than chased.
 */
export async function recalculatePaid(tx: Tx, bookingId: string): Promise<void> {
  const sums = await tx.payment.groupBy({
    by: ['direction'],
    where: { bookingId, status: 'COMPLETED', deletedAt: null },
    _sum: { amountCents: true },
  });

  const paid = sums.find((row) => row.direction === 'IN')?._sum.amountCents ?? 0;
  const refunded = sums.find((row) => row.direction === 'OUT')?._sum.amountCents ?? 0;

  await tx.booking.update({
    where: { id: bookingId },
    data: { netPaidCents: paid - refunded, refundedCents: refunded },
  });
}

/* -------------------------------------------------------------------------- */
/*  Capacity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Puts the departure's places-left back in step with the bookings on it.
 *
 * Only when the departure publishes a capacity at all: `placesTotal` null means
 * the office has chosen not to state one, and inventing a number for them
 * would put a count on the website that was never approved.
 *
 * Draft and cancelled bookings hold no places. A draft is a quote the office is
 * still writing and may never send, and holding a seat against it means a
 * departure that reads full because somebody was thinking aloud.
 *
 * This overwrites a hand-typed `placesLeft`, which is the point. Two numbers
 * that are meant to agree and are maintained separately do not stay agreed,
 * and of the two the bookings are the one that is true.
 */
export async function syncDepartureCapacity(
  tx: Tx,
  departureId: string | null | undefined,
): Promise<void> {
  if (!departureId) return;

  const departure = await tx.departure.findUnique({
    where: { id: departureId },
    select: { id: true, placesTotal: true },
  });
  if (!departure?.placesTotal) return;

  const taken = await tx.booking.aggregate({
    where: {
      departureId,
      deletedAt: null,
      status: { in: ['PROVISIONAL', 'CONFIRMED', 'COMPLETED'] },
    },
    _sum: { adults: true, children: true },
  });

  const heads = (taken._sum.adults ?? 0) + (taken._sum.children ?? 0);

  await tx.departure.update({
    where: { id: departureId },
    data: { placesLeft: Math.max(0, departure.placesTotal - heads) },
  });
}

/* -------------------------------------------------------------------------- */
/*  Writing one                                                                */
/* -------------------------------------------------------------------------- */

/** A date from the wire, or null. Empty strings arrive from cleared inputs. */
export function date(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The dates a booking runs on.
 *
 * A fixed-departure booking takes them from the departure, because a booking
 * on the 4 April departure that says it starts on the 6th is a booking
 * somebody will act on. Everything else carries its own.
 */
export async function resolveDates(
  tx: Tx,
  input: BookingInput,
): Promise<{ startDate: Date | null; endDate: Date | null; departureId: string | null }> {
  if (input.kind === 'FIXED_DEPARTURE' && input.departureId) {
    const departure = await tx.departure.findUnique({
      where: { id: input.departureId },
      select: { id: true, startDate: true, endDate: true, tripId: true },
    });
    if (!departure) throw conflict('That departure no longer exists.');
    return {
      startDate: departure.startDate,
      endDate: departure.endDate,
      departureId: departure.id,
    };
  }

  return {
    startDate: date(input.startDate),
    endDate: date(input.endDate),
    /* Kind changed away from fixed: the departure link goes, or the booking
       keeps holding a seat on a departure it is no longer on. */
    departureId: null,
  };
}

/**
 * What the detail screen and the list both need loaded.
 *
 * One constant rather than two `include` blocks, so a field added to the
 * detail screen cannot be missing from the row the save returns — which is the
 * shape of bug where a form goes blank after a successful save.
 */
export const bookingInclude = {
  trip: { select: { id: true, title: true, slug: true } },
  departure: { select: { id: true, startDate: true, endDate: true, status: true } },
  customer: {
    select: { id: true, name: true, email: true, phone: true, country: true },
  },
  assignee: { select: { id: true, name: true } },
  enquiry: { select: { id: true, reference: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  travellers: { orderBy: { sortOrder: 'asc' } },
  payments: {
    where: { deletedAt: null },
    orderBy: { paidAt: 'desc' },
    include: { recordedBy: { select: { id: true, name: true } } },
  },
  noteRows: {
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true } } },
  },
} satisfies Prisma.BookingInclude;

export type BookingWithEverything = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

/**
 * What is still owed, and what state the money is in.
 *
 * Re-exported from `lib/booking-money.ts` rather than defined here: the tables
 * need the same arithmetic and this module is `server-only`, so a client
 * component importing it would throw at module load. One definition, reachable
 * from both sides, is the only arrangement where the list and the detail
 * screen cannot disagree about whether a booking is paid.
 */
export {
  balanceCents,
  paymentState,
  type Money,
  type PaymentState,
} from '@/lib/booking-money';
