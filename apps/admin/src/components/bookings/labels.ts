import type { PaymentState } from '@/server/services/booking';

/**
 * The words the office uses for these, in one place.
 *
 * Not `humanise()`. That turns `FIXED_DEPARTURE` into "Fixed departure", which
 * is the enum read aloud rather than what anybody says — and it would turn
 * `PROVISIONAL` into "Provisional" where the office says "Held". The point of
 * a panel is that it speaks the office's language, and a generic title-caser
 * cannot.
 *
 * Kept free of React so the tables, the selects and the API-facing code can
 * share it.
 */

export const BOOKING_KIND: Record<string, string> = {
  FIXED_DEPARTURE: 'On a fixed departure',
  PRIVATE: 'Private',
  CUSTOM: 'Made to order',
};

/** The same, short enough for a table cell. */
export const BOOKING_KIND_SHORT: Record<string, string> = {
  FIXED_DEPARTURE: 'Fixed date',
  PRIVATE: 'Private',
  CUSTOM: 'Made to order',
};

export const BOOKING_STATUS: Record<string, string> = {
  DRAFT: 'Draft',
  PROVISIONAL: 'Held',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Travelled',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATE: Record<PaymentState, string> = {
  UNPAID: 'Nothing paid',
  PART_PAID: 'Part paid',
  PAID: 'Paid',
  OVERPAID: 'Overpaid',
  REFUNDED: 'Refunded',
};

export const PAYMENT_STATUS: Record<string, string> = {
  PENDING: 'Expected',
  COMPLETED: 'Cleared',
  FAILED: 'Failed',
  CANCELLED: 'Voided',
};

export const PAYMENT_KIND: Record<string, string> = {
  DEPOSIT: 'Deposit',
  BALANCE: 'Balance',
  FULL: 'Paid in full',
  EXTRA: 'Extra',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
};

export const PAYMENT_METHOD: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  CASH: 'Cash',
  WISE: 'Wise',
  PAYPAL: 'PayPal',
  CHEQUE: 'Cheque',
  OTHER: 'Something else',
};

export const ITEM_KIND: Record<string, string> = {
  JOURNEY: 'The journey',
  SUPPLEMENT: 'Supplement',
  EXTRA: 'Extra',
  PERMIT: 'Permit',
  FEE: 'Fee',
  DISCOUNT: 'Discount',
  OTHER: 'Other',
};

export const BOOKING_SOURCE: Record<string, string> = {
  CONTACT: 'The contact form',
  TRIP_DETAIL: 'A journey page',
  DRAWER: 'The enquiry drawer',
  NEWSLETTER: 'The newsletter',
  PHONE: 'Telephone',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  WALK_IN: 'Walked in',
};

/**
 * Solo or a group, from the party size.
 *
 * Derived rather than stored — see the note on `BookingKind` in the schema.
 * A booking that grows from one traveller to three stops being solo without
 * anybody having to remember to change a field.
 */
export function partyLabel(adults: number, children: number): string {
  const total = adults + children;
  if (total === 1) return 'Solo';
  const parts = [`${adults} adult${adults === 1 ? '' : 's'}`];
  if (children > 0) parts.push(`${children} child${children === 1 ? '' : 'ren'}`);
  return parts.join(', ');
}
