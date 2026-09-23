import Link from 'next/link'
import type { ReactNode } from 'react'
import { Divider, Eyebrow } from '@/design-system'
import { fmt, type Trip } from '@/content/types'
import { Reveal } from '@/motion'

/**
 * A band at the foot of a detail page: what else to read, in another section.
 *
 * This is where the three sections meet. A place lists the culture seen there
 * and the entries written about it; a culture piece lists where to see it; an
 * entry lists the places it is about. Each is a link, never a copy.
 */
export function RelatedBand({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <section style={{ padding: '0 var(--gutter) var(--space-10)' }}>
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto' }}>
        <Divider variant="kera" />
        <div style={{ marginTop: 'var(--space-8)' }}>
          <Reveal>
            <Eyebrow>{title}</Eyebrow>
            {lead && (
              <p
                style={{
                  marginTop: 16,
                  color: 'var(--text-muted)',
                  maxWidth: 'var(--measure-narrow)',
                  lineHeight: 'var(--leading-body)',
                }}
              >
                {lead}
              </p>
            )}
          </Reveal>
          {children}
        </div>
      </div>
    </section>
  )
}

/** Cards in three columns, entering one after another. */
export function CardGrid({ children }: { children: ReactNode[] }) {
  return (
    <ul
      className="lp-three-col"
      style={{
        listStyle: 'none',
        margin: 'var(--space-7) 0 0',
        padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
        gap: 'var(--space-8) var(--space-6)',
      }}
    >
      {children.map((child, i) => (
        <Reveal key={i} as="li" delay={i * 180} y={40}>
          {child}
        </Reveal>
      ))}
    </ul>
  )
}

/** The journeys through a place, as the Where we go page always listed them. */
export function JourneyList({ trips }: { trips: Trip[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 'var(--space-7) 0 0', padding: 0, display: 'grid', maxWidth: 'var(--measure)' }}>
      {trips.map((trip) => (
        <li key={trip.slug} style={{ borderTop: '1px solid var(--border-gold)' }}>
          <Link
            href={`/trips/${trip.slug}`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 0',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span>{trip.title}</span>
            <span style={{ color: 'var(--text-muted)' }}>{fmt.duration(trip)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
