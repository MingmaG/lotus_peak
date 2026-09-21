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
