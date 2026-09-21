import { getContent } from '@/content'

/**
 * The site in one screen, for a generative engine.
 *
 * A crawler wants the markup around the facts. A model wants the facts, in
 * order, without the chrome — and what it gets from a rendered page instead is
 * a navigation, a cookie notice, a three-column footer and the same company
 * address on every one of forty pages, all of which it spends context
 * discarding before it reaches an itinerary.
 *
 * Generated from published rows. A hand-written one is correct on the day it
 * is written and lies about the catalogue three departures later.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const text = await getContent().discovery.llmsTxt()

  return new Response(text, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
