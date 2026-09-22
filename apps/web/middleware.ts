import { NextResponse, type NextRequest } from 'next/server'

/**
 * Redirects, and the path header the 404 page needs.
 *
 * ## Why redirects are here and not in the 404 page
 *
 * They were in `not-found.tsx`, which looked like the cheaper place — only
 * requests that were going to fail would pay for the lookup. It cost the whole
 * site its static rendering.
 *
 * The root `not-found.tsx` is part of every route's shell. Marking it
 * `force-dynamic`, which it had to be to read the request, marked **every page
 * on the site** dynamic: eleven routes went from prerendered HTML to
 * server-rendered on demand, and the build output said so in a column nobody
 * reads until the pages are slow. A site whose entire value is prerendered
 * pages must not have a dynamic 404.
 *
 * So the lookup is here, where it belongs — and the table is cached in module
 * scope for a minute so it is one fetch a minute rather than one a request.
 *
 * ## Failing open
 *
 * If the admin panel cannot be reached, there are no redirects and every
 * request goes through untouched. A site that 503s because a redirect table
 * was unavailable would be a worse outcome than an old link that 404s.
 */

interface Redirect {
  source: string
  target: string
  permanent: boolean
}

/**
 * The table, and when it was fetched.
 *
 * Module scope, which in middleware means per edge instance and is exactly
 * right: it is a read-only cache of published data, every instance can hold
 * its own copy, and the worst staleness is one minute.
 */
let cache: { at: number; rows: Redirect[] } | null = null
const TTL_MS = 60_000

async function redirects(): Promise<Redirect[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows

  const base = process.env.CONTENT_API_URL
  if (!base) return []

  try {
    const response = await fetch(
      `${base.replace(/\/$/, '')}/api/public/site/discovery?part=redirects`,
      { signal: AbortSignal.timeout(2_000) },
    )
    if (!response.ok) return cache?.rows ?? []
    const body = (await response.json()) as { data: Redirect[] }
    cache = { at: Date.now(), rows: body.data }
    return body.data
  } catch {
    /* Keep serving the last good table rather than dropping every redirect
       because one fetch timed out. */
    return cache?.rows ?? []
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const match = (await redirects()).find(
    (row) => row.source === pathname || row.source === pathname.replace(/\/$/, ''),
  )

  if (match) {
    const url = new URL(match.target, request.nextUrl.origin)
    /* 308 and 307, which preserve the method — a 301 turns a POST into a GET,
       and this table is also followed by forms somebody bookmarked. */
    return NextResponse.redirect(url, match.permanent ? 308 : 307)
  }

  /**
   * The requested path, for the 404 page's beacon.
   *
   * A 404 page has no way to ask what was requested — the route is gone by the
   * time it renders — and this is the only place it still exists.
   */
  const headers = new Headers(request.headers)
  headers.set('x-lotuspeak-path', pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/|assets/|favicon.ico).*)'],
}
