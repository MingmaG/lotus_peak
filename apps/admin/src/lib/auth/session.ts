import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { IMPOSSIBLE_HASH, hashPassword, verifyPassword } from './password';
import { can, type Permission } from './permissions';
import {
  ACCESS_MAX_AGE,
  COOKIE,
  REFRESH_MAX_AGE,
  cookieOptions,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type AccessTokenInput,
} from './tokens';

/**
 * Who is asking, on the server.
 *
 * Server components and route handlers call {@link currentUser} or
 * {@link requirePermission}; nothing reads the cookie itself. The middleware
 * has already rejected a request with no token at all, so the job here is to
 * turn a valid token into claims, not to guard the route — which is why the
 * functions that *do* guard say so in their names.
 */

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  roleSlug: string;
  permissions: string[];
  sessionId: string;
};

export async function currentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE.access)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    roleSlug: claims.roleSlug,
    permissions: claims.permissions,
    sessionId: claims.sessionId,
  };
}

/** For a page. Redirects to the login screen rather than throwing. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

export class ForbiddenError extends Error {
  constructor(readonly permission: Permission) {
    super(`This account does not have ${permission}.`);
    this.name = 'ForbiddenError';
  }
}

/**
 * For a page that needs one specific permission.
 *
 * A missing permission sends them to `/no-access`, naming what is missing —
 * not to the login screen, which tells a signed-in person nothing, and not by
 * throwing, which is a 500 with a digest on it. The one place a thrown error
 * would have worked is a route handler, and no route handler calls this: the
 * `route()` wrapper declares its permission and raises {@link ForbiddenError}
 * itself, where a 403 with the permission in the body is the right answer.
 *
 * `redirect` throws `NEXT_REDIRECT`, so like every `redirect` this must not be
 * called inside a `try` that swallows it.
 */
export async function requirePermission(required: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.permissions, required)) {
    redirect(`/no-access?need=${encodeURIComponent(required)}`);
  }
  return user;
}

export async function hasPermission(required: Permission): Promise<boolean> {
  const user = await currentUser();
  return can(user?.permissions, required);
}

/* -------------------------------------------------------------------------- */
/*  Signing in and out                                                         */
/* -------------------------------------------------------------------------- */

export { hashPassword, verifyPassword };

/** After five failures. Long enough to stop a script, short enough to wait out. */
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: 'credentials' | 'locked' | 'inactive'; retryAfterMinutes?: number };

export async function signIn(email: string, password: string): Promise<LoginResult> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { role: true },
  });

  /**
   * The same answer for "no such account" and "wrong password".
   *
   * Distinguishing them turns the login form into an oracle for which
   * addresses have accounts, which is the first step of every credential
   * stuffing run. The bcrypt comparison below runs even without a user, so the
   * two paths also take the same time.
   */
  if (!user || user.deletedAt) {
    await verifyPassword(password, IMPOSSIBLE_HASH);
    return { ok: false, reason: 'credentials' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, reason: 'locked', retryAfterMinutes: minutes };
  }

  if (!user.isActive) return { ok: false, reason: 'inactive' };

  const correct = await verifyPassword(password, user.passwordHash);
  if (!correct) {
    const failures = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failures,
        lockedUntil:
          failures >= LOCK_AFTER
            ? new Date(Date.now() + LOCK_MINUTES * 60_000)
            : null,
      },
    });
    return { ok: false, reason: 'credentials' };
  }

  const headerList = await headers();
  const session = await db.session.create({
    data: {
      userId: user.id,
      /* Filled immediately below, once the token it hashes exists. */
      tokenHash: `pending:${crypto.randomUUID()}`,
      userAgent: headerList.get('user-agent')?.slice(0, 500) ?? null,
      ipAddress: clientIp(headerList),
      expiresAt: new Date(Date.now() + REFRESH_MAX_AGE() * 1000),
    },
  });

  const refreshToken = await signRefreshToken(user.id, session.id);
  await db.session.update({
    where: { id: session.id },
    data: { tokenHash: await hashToken(refreshToken) },
  });

  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const claims: AccessTokenInput = {
    sub: user.id,
    email: user.email,
    name: user.name,
    roleSlug: user.role.slug,
    permissions: user.role.permissions,
    sessionId: session.id,
  };

  await writeCookies(await signAccessToken(claims), refreshToken);

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleSlug: user.role.slug,
      permissions: user.role.permissions,
      sessionId: session.id,
    },
  };
}

/** Whether a refresh cookie is present at all. Reads; never writes. */
export async function hasRefreshCookie(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(COOKIE.refresh)?.value);
}

/**
 * Exchanges a refresh token for a fresh access token.
 *
 * This is the path that reads the database, and that is deliberate: it is
 * where a deactivated account, a changed role and a revoked session all take
 * effect. Fifteen minutes is the longest any of those can lag.
 *
 * **Route handlers and server actions only.** It writes the access cookie, and
 * a Server Component that writes a cookie does not fail quietly — it throws
 * "Cookies can only be modified in a Server Action or Route Handler" and takes
 * the page down with it. The login page used to call this directly, so anybody
 * whose access token had expired overnight met a 500 instead of a sign-in
 * form: the one request this function exists to rescue was the one it broke.
 * `hasRefreshCookie` is the read-only half a component may use.
 */
export async function refresh(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE.refresh)?.value;
  if (!token) return null;

  const claims = await verifyRefreshToken(token);
  if (!claims) return null;

  const session = await db.session.findUnique({
    where: { id: claims.sessionId },
    include: { user: { include: { role: true } } },
  });

  const hash = await hashToken(token);
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.tokenHash !== hash ||
    !session.user.isActive ||
    session.user.deletedAt
  ) {
    await signOut();
    return null;
  }

  await db.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  const user = session.user;
  const access = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    roleSlug: user.role.slug,
    permissions: user.role.permissions,
    sessionId: session.id,
  });

  store.set(COOKIE.access, access, cookieOptions(ACCESS_MAX_AGE()));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleSlug: user.role.slug,
    permissions: user.role.permissions,
    sessionId: session.id,
  };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE.refresh)?.value;

  if (token) {
    const claims = await verifyRefreshToken(token);
    if (claims?.sessionId) {
      /* Revoked, not deleted. "Where am I signed in" is a question about
         history as well as about now, and a deleted row answers neither. */
      await db.session
        .update({
          where: { id: claims.sessionId },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
    }
  }

  store.delete(COOKIE.access);
  store.delete(COOKIE.refresh);
}

/** Signs one person out of every browser. */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

async function writeCookies(access: string, refresh: string) {
  const store = await cookies();
  store.set(COOKIE.access, access, cookieOptions(ACCESS_MAX_AGE()));
  store.set(COOKIE.refresh, refresh, cookieOptions(REFRESH_MAX_AGE()));
}

/**
 * The client's address, as far as it can be known.
 *
 * `x-forwarded-for` is a list and the first entry is the client; the ones
 * after it are proxies. It is also trivially forged, which is why this is used
 * for an audit line and never for an authorisation decision.
 */
function clientIp(headerList: Headers): string | null {
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return headerList.get('x-real-ip');
}

export { env };
