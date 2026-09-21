import { NextResponse, type NextRequest } from 'next/server'

/**
 * Writes the requested path into a header.
 *
 * That is all it does, and the restraint is the point. A redirect table
 * consulted here would be a lookup on every request to a site where almost
 * every request is for a page that exists; `not-found.tsx` consults it
 * instead, and pays the cost only on requests that were going to fail.
 *
 * But a 404 page has no way to ask what was requested — the route is gone by
 * the time it renders — so the one thing middleware is needed for is carrying
 * the path across that boundary.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers)
  headers.set('x-lotuspeak-path', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: [
    /* Everything but Next's own assets, the API and the files in public/. */
    '/((?!_next/static|_next/image|api/|assets/|favicon.ico).*)',
  ],
}
