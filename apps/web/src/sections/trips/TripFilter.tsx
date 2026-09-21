'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs } from '@/design-system'
import { FILTERS, TYPE_OF, toFilterLabel, type FilterLabel } from './filters'

/**
 * The journey filter.
 *
 * The filter is a URL param, so a filtered list is shareable, linkable and
 * back-buttonable. What it is *not* is a server-side filter: reading
 * `searchParams` in the page made `/trips` the one route on this site rendered
 * on every request, and this is the journeys index — the page a search engine
 * cares most about and the page most likely to be opened on a hotel
 * connection.
 *
 * So the server renders all five journeys into the static HTML and the browser
 * hides the ones that do not match. That is better for a crawler than
 * server-side filtering was, not worse: every journey is in the markup of the
 * index, whatever the URL says. Without JavaScript the page shows all five,
 * which is the honest answer to "what journeys are there".
 *
 * Five is the number this scales to. If Lotus Peak ever run fifty, this should
 * go back to the server and take pagination with it.
 */
export function TripFilter({
  /** Which types have at least one journey, so the empty state can be right. */
  present,
}: {
  present: string[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const value = toFilterLabel(params.get('type') ?? undefined)

  /**
   * The filter is applied by attribute, not by re-rendering the list.
   *
   * The cards are server-rendered and this component does not own them, so it
   * marks the grid and lets one CSS rule in `globals.css` do the hiding. The
   * alternative — lifting the list into this client component — would take the
   * journeys out of the prerendered HTML, which is the thing being protected.
   */
  useEffect(() => {
    const type = value === 'All' ? 'all' : TYPE_OF[value]
    for (const node of document.querySelectorAll<HTMLElement>('[data-trip-filter]')) {
      node.dataset.tripFilter = type
    }
    const empty = document.querySelector<HTMLElement>('[data-trip-empty]')
    if (empty) empty.hidden = value === 'All' || present.includes(TYPE_OF[value])
  }, [value, present])

  return (
    <Tabs
      aria-label="Filter journeys by type"
      tabs={[...FILTERS]}
      value={value}
      onChange={(tab) => {
        const next = new URLSearchParams(params.toString())
        if (tab === 'All') next.delete('type')
        else next.set('type', tab)
        const qs = next.toString()
        router.replace(qs ? `/trips?${qs}` : '/trips', { scroll: false })
      }}
      style={{ marginTop: 'var(--space-8)' }}
    />
  )
}
