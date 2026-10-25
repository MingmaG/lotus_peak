import type { WhatsApp } from '@/content/types'
import { siteUrl } from './env'

/**
 * The `wa.me` link that opens a chat with the office, with the message filled in.
 *
 * Away from a journey, the message is the office's own opening line from the
 * panel. On a journey page it is that line, then the journey's name and its
 * address — so the office knows which journey without asking, and WhatsApp
 * draws the page's preview card under the link. Nothing is added in words of
 * this file's own: every sentence a traveller sends is one the office wrote.
 *
 * The floating button and the journey page's enquiry band both build their
 * link here, so the two can never send different messages from one page.
 */
export function whatsappHref(whatsapp: WhatsApp, trip?: { slug: string; title: string }): string {
  const lines = [
    whatsapp.prefill,
    trip ? `${trip.title}\n${siteUrl()}/trips/${trip.slug}` : null,
  ].filter(Boolean)

  const text = lines.join('\n\n')
  return `https://wa.me/${whatsapp.number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
