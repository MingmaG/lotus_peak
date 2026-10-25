'use client'

import { WhatsAppIcon } from '@/design-system'
import type { Trip, WhatsApp } from '@/content/types'
import { whatsappHref } from '@/lib/whatsapp'

const TRIP_PATH = /^\/trips\/([^/]+)$/

/**
 * The WhatsApp button that stays in the bottom-left corner of every page.
 *
 * Bottom left, not the usual bottom right, because the right edge already
 * belongs to the dignity rail. Rendered only when the office has entered a
 * WhatsApp number — `SiteChrome` decides that — so taking the number out of
 * the panel takes the button off the site at the next publish.
 *
 * On a journey page the message names that journey (`lib/whatsapp.ts`). The
 * journey is found from the path and the list the chrome already holds, so
 * no page has to tell the chrome where it is.
 *
 * The beam is two rings spreading out of the button, half a cycle apart, in
 * `globals.css`. Under reduced motion they are not drawn at all.
 */
export function WhatsAppFloat({
  whatsapp,
  pathname,
  trips,
}: {
  whatsapp: WhatsApp
  pathname: string
  trips: Pick<Trip, 'slug' | 'title'>[]
}) {
  const slug = TRIP_PATH.exec(pathname)?.[1]
  const trip = slug ? trips.find((t) => t.slug === slug) : undefined
  const name = `${whatsapp.label} ${whatsapp.display}`

  return (
    <a
      href={whatsappHref(whatsapp, trip)}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={name}
      title={name}
      className="lp-whatsapp"
    >
      <span className="lp-whatsapp-beam" aria-hidden />
      <span className="lp-whatsapp-beam" aria-hidden />
      <WhatsAppIcon size={30} />
    </a>
  )
}
