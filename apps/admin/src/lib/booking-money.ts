/**
 * What a booking's figures mean, for both sides of the wire.
 *
 * Its own file rather than part of `server/services/booking.ts`, because that
 * module is `server-only` — importing it from a table component would throw at
 * module load. These are pure arithmetic over numbers the row already carries,
 * and the screens need them to say "still owes $2,400" without asking the
 * server a second time.
 *
 * `netPaidCents` is already net of refunds when it reaches here; the schema
 * comment on the column explains why it is stored that way rather than being
 * subtracted at each point of use. Nothing in this file should ever subtract
 * `refundedCents` again — that was the bug the column was renamed to prevent.
 */

export type PaymentState = 'UNPAID' | 'PART_PAID' | 'PAID' | 'OVERPAID' | 'REFUNDED';

export interface Money {
  totalCents: number;
  /** Payments in less payments out, both `COMPLETED`. */
  netPaidCents: number;
  /** Payments out alone. Only used to tell "never paid" from "paid and given back". */
  refundedCents: number;
}

/** What is still owed. Negative means the booking has been overpaid. */
export function balanceCents(booking: Money): number {
  return booking.totalCents - booking.netPaidCents;
}

/**
 * Refunded is checked first, and deliberately.
 *
 * A cancelled booking that took $2,000 and gave it back nets to zero, and
 * calling that "nothing paid" would put it on the list of people to chase. The
 * two are told apart by whether money ever went back out.
 */
export function paymentState(booking: Money): PaymentState {
  if (booking.refundedCents > 0 && booking.netPaidCents <= 0) return 'REFUNDED';
  if (booking.netPaidCents <= 0) return 'UNPAID';
  if (booking.netPaidCents < booking.totalCents) return 'PART_PAID';
  if (booking.netPaidCents > booking.totalCents) return 'OVERPAID';
  return 'PAID';
}
