'use client'

import { useEffect } from 'react'

/**
 * Tells the admin panel that an address was asked for and not found.
 *
 * A client component, which is the point: the 404 page stays static. Reading
 * the request on the server would mean `force-dynamic` on `not-found.tsx`, and
 * the root not-found is part of every route's shell — so that one directive
 * turns the whole prerendered site into a server-rendered one.
 *
 * The trade is that a visitor with no JavaScript is not recorded. That is
 * closer to a feature than a cost here: most 404 traffic is scanners guessing
 * at `/wp-admin`, and the misses worth acting on are the ones a person
 * followed from a real link — which is exactly what this records, with
 * `document.referrer` as the evidence.
 */
export function NotFoundBeacon() {
  useEffect(() => {
    const path = window.location.pathname
    if (!path || path === '/') return

    /* `keepalive` so it survives the visitor immediately clicking away, which
       on a 404 page is the usual case. */
    void fetch('/api/not-found', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, referrer: document.referrer || null }),
      keepalive: true,
    }).catch(() => undefined)
  }, [])

  return null
}
