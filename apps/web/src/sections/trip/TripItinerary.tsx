'use client'

import { useState } from 'react'
import { Button, Disclosure, Itinerary } from '@/design-system'
import type { ItineraryDayData } from '@/content/types'

export function TripItinerary({ days }: { days: ItineraryDayData[] }) {
  const [open, setOpen] = useState<number[]>([0])
  const allOpen = open.length === days.length

  return (
    <div style={{ maxWidth: 900, margin: 'var(--space-8) auto 0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <Button variant="ghost" onClick={() => setOpen(allOpen ? [] : days.map((_, i) => i))}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      <Itinerary
        collapsible
        days={days}
        expanded={open}
        onToggle={(i) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))}
      />
    </div>
  )
}

/** FAQ over the shared Disclosure — the design project's version pops open with no transition and no ARIA pairing (audit B12). */
export function TripFaq({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState(0)

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {items.map((item, i) => (
        <div key={item.question} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
          <Disclosure
            open={open === i}
            onToggle={() => setOpen(open === i ? -1 : i)}
            summary={item.question}
          >
            <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', maxWidth: 'var(--measure)' }}>
              {item.answer}
            </p>
          </Disclosure>
        </div>
      ))}
    </div>
  )
}
