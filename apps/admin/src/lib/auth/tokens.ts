import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

import { env } from '@/lib/env';

/**
 * Access and refresh tokens.
 *
 * `jose` rather than `jsonwebtoken` because the middleware runs on the edge
 * runtime, which has WebCrypto and no Node `crypto`. This module is imported
 * by it, so nothing here may touch a Node built-in or Prisma.
 *
 * ## Why two tokens
 *
 * The access token is fifteen minutes, stateless, and checked on every request
 * without a query. The refresh token is thirty days and is checked against a
 * `Session` row, which is what makes "sign this person out everywhere" and
 * "show me where I am signed in" answerable at all.
 *
 * They are signed with **different secrets**. One secret would mean a leaked
 * access token — from a log line, a proxy, an error report — can be replayed
 * against the refresh endpoint to mint a thirty-day session. Two means
 * rotating the access secret does not sign everybody out, and a leak of either
 * is bounded.
 */

const ISSUER = 'lotuspeak-admin';
const ACCESS_AUDIENCE = 'access';
const REFRESH_AUDIENCE = 'refresh';

const encoder = new TextEncoder();
const accessKey = encoder.encode(env.auth.secret);
const refreshKey = encoder.encode(env.auth.refreshSecret);

export interface AccessClaims extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  roleSlug: string;
  /**
   * The permissions themselves, in the token.
   *
   * The alternative is a role lookup per request, which is a database round
   * trip to answer a question that changes twice a year. The cost is that a
   * permission revoked mid-session applies at the next refresh rather than
   * instantly — fifteen minutes at most — and a deactivated account is handled
   * separately and immediately by the refresh path, which does read the row.
   */
  permissions: string[];
  sessionId: string;
}

/**
 * What `signAccessToken` is given.
 *
 * Spelled out rather than `Omit<AccessClaims, keyof JWTPayload>`, which also
 * removes `sub` — `sub` is a registered JWT claim as well as the user id this
 * application needs, and the subtraction leaves the caller unable to say who
 * the token is for.
 */
export interface AccessTokenInput {
  sub: string;
  email: string;
  name: string;
  roleSlug: string;
  permissions: string[];
  sessionId: string;
}

export async function signAccessToken(claims: AccessTokenInput) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setSubject(claims.sub)
    .setExpirationTime(`${env.auth.accessTtlMinutes}m`)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    });
    return payload as AccessClaims;
  } catch {
    /* An expired or forged token is not exceptional — it is the normal state
       of a tab left open overnight. The caller redirects; nothing is logged. */
    return null;
  }
}

export interface RefreshClaims extends JWTPayload {
  sub: string;
  sessionId: string;
}

export async function signRefreshToken(userId: string, sessionId: string) {
  return new SignJWT({ sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setSubject(userId)
    .setExpirationTime(`${env.auth.refreshTtlDays}d`)
    .sign(refreshKey);
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify(token, refreshKey, {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
    });
    return payload as RefreshClaims;
  } catch {
    return null;
  }
}

/**
 * SHA-256, as hex, using WebCrypto.
 *
 * What goes in the `Session.tokenHash` column. The token itself is never
 * stored: a leaked database dump should be a list of dead sessions, not a set
 * of working ones.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const COOKIE = {
  access: 'lp_access',
  refresh: 'lp_refresh',
} as const;

/**
 * Cookie options.
 *
 * `httpOnly` because no script in this application needs to read a token, and
 * one that could read it is one an XSS can. `sameSite: 'lax'` rather than
 * `strict` so that following a "View on site" link back from the website does
 * not land on the login screen. `secure` follows NODE_ENV, because a secure
 * cookie over plain http in development is a cookie the browser drops without
 * telling anyone.
 */
export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.isProduction,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export const ACCESS_MAX_AGE = () => env.auth.accessTtlMinutes * 60;
export const REFRESH_MAX_AGE = () => env.auth.refreshTtlDays * 24 * 60 * 60;
