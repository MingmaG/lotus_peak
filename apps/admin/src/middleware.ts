import { NextResponse, type NextRequest } from 'next/server';

import { COOKIE, verifyAccessToken } from '@/lib/auth/tokens';

/**
 * The outer gate.
 *
 * Its only job is to keep an unauthenticated request away from a page or an
 * API route that would otherwise query the database. It is deliberately not
 * where authorisation happens: it runs on the edge runtime, has no Prisma and
 * no bcrypt, and a permission check here would be a check against a claim in a
 * token with nothing to compare it to. Permissions are enforced in the route,
 * by `requirePermission`, where the row can be read.
 *
 * It also does not refresh. An expired access token here becomes a redirect to
 * `/login?next=…`, and the login page exchanges the refresh cookie before
 * showing a form — so a person whose tab sat open overnight lands back where
 * they were rather than typing a password again.
 */

/** Open to anyone: the login screen, the auth endpoints, and the health check. */
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/health',
];

/**
 * Open to the website, not to a person.
 *
 * `/api/public/*` is what the marketing site reads, and it carries no
 * credential because it serves only published rows. `/api/storage/*` serves
 * media when the local driver is in use, and the same applies.
 */
const UNAUTHENTICATED_API = ['/api/public', '/api/storage'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    UNAUTHENTICATED_API.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE.access)?.value;
  if (!token) return reject(request);

  /**
   * The verification is asynchronous and middleware may return a promise, so
   * this is the one place the gate actually costs something — an HMAC over a
   * few hundred bytes, with no I/O.
   */
  return verifyAccessToken(token).then((claims) =>
    claims ? NextResponse.next() : reject(request),
  );
}

function reject(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  /**
   * An API route gets a 401, not a redirect to HTML.
   *
   * A fetch that follows a redirect and then fails to parse a login page as
   * JSON reports a syntax error, which is three debugging steps away from
   * "you are signed out".
   */
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  /* Where they were going, so the login can put them back. */
  if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /**
     * Everything except Next's own assets and the favicon.
     *
     * Written as an exclusion rather than a list of protected prefixes so a
     * new screen is protected by existing, and forgetting to add it to a list
     * is not a way to ship an open one.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
