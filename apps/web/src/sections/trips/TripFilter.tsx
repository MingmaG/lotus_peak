'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs } from '@/design-system'
import { FILTERS, type FilterLabel } from './filters'

/**
 * The filter is a URL param, so a filtered list is shareable and crawlable and
 * the filtering itself happens on the server.
 */
export function TripFilter({ value }: { value: FilterLabel }) {
  const router = useRouter()
  const params = useSearchParams()

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
