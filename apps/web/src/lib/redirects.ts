import 'server-only'

import { getContent } from '@/content'

/**
 * Where an address that no longer exists should go.
 *
 * Applied by `not-found.tsx` rather than by middleware, and that is the
 * interesting decision. Middleware runs on **every** request, so a redirect
 * table there is a lookup on every page view of a site where 99.9% of requests
 * are for pages that exist. Doing it in the 404 path means the cost is paid
 * only by requests that were going to fail anyway.
 *
 * The trade is that the response is a 404 with a redirect rather than a 301 —
 * which matters to a crawler. So the *slug-history* redirects, which are the
 * ones a crawler follows, are also matched by the route itself: a journey page
 * asked for an old slug serves a real 301 before it ever reaches here.
 */
export async function redirectFor(path: string): Promise<{ target: string; permanent: boolean } | null> {
  try {
    const redirects = await getContent().discovery.redirects()
    const clean = path.replace(/\/$/, '') || '/'

    return (
      redirects.find((row) => row.source === path || row.source === clean) ?? null
    )
  } catch {
    /* A 404 page that cannot reach the API should still render. */
    return null
  }
}

/**
 * Tells the admin panel something was asked for and not found.
 *
 * Fire and forget: a 404 page must not wait on it, and a failure to record one
 * is not worth a second failure. The admin panel counts repeats, so a bot
 * hammering `/wp-admin` is one row with a big number rather than four thousand.
 */
export function recordNotFound(path: string, referrer: string | null): void {
  const base = process.env.CONTENT_API_URL
  if (!base) return

  /**
   * The home page is never a real miss.
   *
   * It turned up in the log during a dev-server restart — a request that
   * arrived while the route was still compiling — and a "/ was not found" row
   * on the SEO screen is a row that sends somebody looking for a problem that
   * does not exist. Anything that transient is better filtered here than
   * explained there.
   */
  if (path === '/' || path === '') return

  void fetch(`${base.replace(/\/$/, '')}/api/public/not-found`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, referrer }),
    cache: 'no-store',
  }).catch(() => undefined)
}
