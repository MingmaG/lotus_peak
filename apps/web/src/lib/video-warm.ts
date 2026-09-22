'use client'

import { preconnectOrigins, type VideoSource } from '@lotuspeak/video'

/**
 * Warming the connections a film will need, before it is asked for.
 *
 * Called when a visitor hovers or tabs onto a façade, which is a second or two
 * before the click lands — long enough for DNS, TCP and TLS to the player's
 * origin to be done by the time it does. A page with six films pays nothing
 * for the five nobody watches.
 *
 * `warmed` is module scope on purpose: the same origins serve every film on
 * the page, and appending a second `<link rel="preconnect">` for one already
 * warmed does nothing but grow the head.
 */
const warmed = new Set<string>()

export function warmVideoConnections(source: VideoSource | null): void {
  if (typeof document === 'undefined') return

  for (const origin of preconnectOrigins(source)) {
    if (warmed.has(origin)) continue
    warmed.add(origin)

    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = origin
    link.crossOrigin = ''
    document.head.appendChild(link)
  }
}
