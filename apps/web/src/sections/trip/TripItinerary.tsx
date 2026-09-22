'use client'

import type { FaqGroup } from '@/content/types'
import { Prose } from '@/components/site/Prose'
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
/**
 * The questions, with headings where the office made any.
 *
 * `items` is the ungrouped ones and they render first, above every heading —
 * which is what lets a journey have six questions and no headings at all, and
 * lets somebody add a seventh without inventing a heading to put it under.
 *
 * One `open` index across the whole thing, not one per group. Two answers open
 * at once on a page this long is two places to have lost your position.
 */
export function TripFaq({
  items,
  groups = [],
}: {
  items: { question: string; answer: string }[]
  groups?: FaqGroup[]
}) {
  const [open, setOpen] = useState(0)

  /* A flat index over every question, so the one-open rule holds across
     headings. Built here rather than threaded through as offsets, which is the
     same arithmetic done in more places. */
  let index = 0

  const question = (item: { question: string; answer: string }) => {
    const at = index
    index += 1
    return (
      <div key={item.question} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <Disclosure
          open={open === at}
          onToggle={() => setOpen(open === at ? -1 : at)}
          summary={item.question}
        >
          <Prose
            html={item.answer}
            compact
            style={{ margin: '0 0 24px', color: 'var(--text-muted)', maxWidth: 'var(--measure)' }}
          />
        </Disclosure>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {items.map(question)}

      {groups.map((group) => (
        <section key={group.title} style={{ marginTop: 40 }}>
          <h3
            style={{
              fontSize: 'var(--text-label)',
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: group.blurb ? 8 : 16,
            }}
          >
            {group.title}
          </h3>
          {group.blurb && (
            <Prose
              html={group.blurb}
              compact
              style={{ marginBottom: 16, color: 'var(--text-muted)' }}
            />
          )}
          {group.items.map(question)}
        </section>
      ))}
    </div>
  )
}
