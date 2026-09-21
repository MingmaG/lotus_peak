import bcrypt from 'bcryptjs';

/**
 * Hashing, on its own.
 *
 * Separated from `session.ts` because that module imports `next/navigation`
 * for `redirect`, and anything that pulls it in drags the whole App Router
 * client runtime with it. The seed and the CLI scripts need to hash a password
 * and nothing else; before this split, `npm run db:seed` failed inside React's
 * context machinery with an error naming neither.
 */

/**
 * Work factor 12.
 *
 * Roughly 250 ms on the hardware this runs on. Ten is the common default and
 * is cheap enough to be worth brute-forcing offline; fourteen would make the
 * login screen feel broken. This is the number that costs an attacker
 * meaningfully and a person imperceptibly.
 */
const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A hash that nothing matches, for the "no such account" path.
 *
 * `signIn` compares against it when the address is unknown, so a request for a
 * non-existent account takes the same ~250 ms as a request for a real one.
 * Without it the login form is a timing oracle for which addresses have
 * accounts, which is the first step of every credential-stuffing run.
 */
export const IMPOSSIBLE_HASH =
  '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
