import { headers } from 'next/headers'
import { permanentRedirect, redirect } from 'next/navigation'
import { Button, Eyebrow } from '@/design-system'
import { recordNotFound, redirectFor } from '@/lib/redirects'

/**
 * Where a wrong address is dealt with.
 *
 * Three things happen here, in this order:
 *
 * 1. **The redirect table is consulted.** An address the office has mapped —
 *    by hand, or automatically when a slug was renamed — sends the visitor on
 *    rather than showing them this page.
 * 2. **The miss is recorded.** The admin panel counts repeats, so the SEO
 *    screen can show which broken addresses are actually being asked for and
 *    which are a bot guessing at `/wp-admin`. The referrer is the useful part:
 *    a 404 arriving with one from another site is a real inbound link.
 * 3. **This page renders**, and it offers the two places somebody in this
 *    position actually wants.
 *
 * `dynamic` is forced because all three need the request. Without it Next
 * prerenders this page at build time, the redirect table is whatever it was
 * then, and nothing is ever recorded.
 */
export const dynamic = 'force-dynamic'

export default async function NotFound() {
  const headerList = await headers()
  /**
   * The path, from the header the middleware sets.
   *
   * `notFound()` gives a component no way to ask what was requested — by the
   * time it renders, the route has been discarded. The middleware writes it
   * into a header on the way in, which is the only place it still exists.
   */
  const path = headerList.get('x-lotuspeak-path') ?? ''
  const referrer = headerList.get('referer')

  if (path) {
    const match = await redirectFor(path)
    if (match) {
      /**
       * 308 for a permanent move, 307 for a temporary one.
       *
       * `redirect()` is 307 for everything, which tells a crawler the old
       * address is coming back — so a renamed journey would keep its old URL
       * indexed forever and split its own ranking between two. The whole point
       * of writing a 301 when a slug changes is lost if the site then serves
       * it as a 307.
       */
      if (match.permanent) permanentRedirect(match.target)
      redirect(match.target)
    }
    recordNotFound(path, referrer)
  }

  return (
    <main
      style={{
        padding: 'var(--space-10) var(--gutter) var(--space-11)',
        maxWidth: 'var(--container-text)',
        margin: '0 auto',
      }}
    >
      <Eyebrow number="404">Not found</Eyebrow>
      <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '16ch' }}>
        This path does not go anywhere
      </h1>
      <p style={{ marginTop: 20, fontSize: 'var(--text-lead)', color: 'var(--text-muted)' }}>
        The page you were looking for is not here. The journeys are, and so are we.
      </p>
      <div style={{ marginTop: 'var(--space-7)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Button href="/trips">Our trips</Button>
        <Button variant="outline" href="/">
          Home
        </Button>
      </div>
    </main>
  )
}
