import { customAlphabet } from 'nanoid';

/**
 * A short code for an enquiry: `LP-7QK4`.
 *
 * The alphabet has no `I`, `O`, `0` or `1` in it. The first thing this office
 * does with a reference is read it down a telephone, and every one of those
 * four is a character somebody transcribes as a different one.
 */
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const nano = customAlphabet(alphabet, 4);

export function enquiryReference(): string {
  return `LP-${nano()}`;
}

/**
 * A booking: `LP-B-7QK4`. A payment against one: `LP-P-7QK4`.
 *
 * The letter is in the middle rather than the end because these are read out
 * and written down together — "payment LP-P-3RKM against booking LP-B-7QK4" —
 * and a distinguishing character at the front of the code is one somebody
 * hears before they have stopped listening for the number.
 *
 * Four characters from a 32-letter alphabet is a million codes, which is more
 * than this office will write in its lifetime and few enough to say. Uniqueness
 * is the database's job either way: both columns are unique and the caller
 * retries, because a birthday collision on a short code is a thing that
 * happens and a thing a unique index catches for nothing.
 */
export function bookingReference(): string {
  return `LP-B-${nano()}`;
}

export function paymentReference(): string {
  return `LP-P-${nano()}`;
}
