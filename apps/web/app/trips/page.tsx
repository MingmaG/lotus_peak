import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Button, Eyebrow, TrekCard } from '@/design-system'
import { getContent } from '@/content'
import { ogImage } from '@/lib/seo'
import { IMG } from '@/lib/assets'
import { fmt } from '@/content/types'
import { Reveal } from '@/motion'
import { TripFilter } from '@/sections/trips/TripFilter'
import { TYPE_OF, toFilterLabel, type FilterLabel } from '@/sections/trips/filters'

export const metadata: Metadata = {
  title: 'Our trips',
  description:
    'Five journeys through Bhutan: mindfulness, meditation, two around a festival, and the Jomolhari trek. Prices include all permits, meals, accommodation, the Sustainable Development Fee and a guide throughout.',
  openGraph: { images: ogImage(IMG.hike) },
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const label = toFilterLabel(type)
  const trips = await getContent().trips.list(
    label === 'All' ? undefined : { type: TYPE_OF[label as Exclude<FilterLabel, 'All'>] },
  )

  return (
    <main
      style={{
        position: 'relative',
        padding: 'var(--space-8) var(--gutter) var(--space-10)',
        maxWidth: 'var(--container)',
        margin: '0 auto',
      }}
    >
      {/* The design project's trips index is the one screen with no entrance
          animation at all (docs/audit/effects-integration.md B2). It is staged
          here on the same cadence as every other screen. */}
      <Reveal>
        <Eyebrow number="Our trips">Journeys in Bhutan</Eyebrow>
        <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '20ch' }}>
          Five ways through the kingdom
        </h1>
      </Reveal>

      <Reveal delay={200}>
        <p
          style={{
            marginTop: 20,
            fontSize: 'var(--text-lead)',
            lineHeight: 'var(--leading-lead)',
            maxWidth: 'var(--measure-narrow)',
            color: 'var(--text-muted)',
          }}
        >
          Prices are per adult and include all permits, meals, accommodation and a guide throughout. Departures
          are small; write to us and we will find a date together.
        </p>
      </Reveal>

      <Reveal delay={400}>
        <Suspense fallback={<div style={{ height: 49, marginTop: 'var(--space-8)' }} />}>
          <TripFilter value={label} />
        </Suspense>
      </Reveal>

      {trips.length === 0 ? (
        <Reveal delay={200}>
          <div style={{ marginTop: 'var(--space-9)', maxWidth: 'var(--measure-narrow)' }}>
            <p style={{ fontSize: 'var(--text-lead)', color: 'var(--text-muted)' }}>
              No journeys of that kind yet. Write to us and we will build one.
            </p>
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Button href="/contact">Begin a conversation</Button>
            </div>
          </div>
        </Reveal>
      ) : (
        <div
          key={label}
          className="lp-trip-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
            gap: 'var(--space-8) var(--space-6)',
            marginTop: 'var(--space-8)',
          }}
        >
          {trips.map((t, i) => (
            <Reveal key={t.slug} delay={i * 220} y={40}>
              <TrekCard
                href={`/trips/${t.slug}`}
                size="lg"
                kera={false}
                image={t.heroImage}
                imageAlt={t.heroAlt}
                title={t.title}
                region={fmt.regions(t)}
                days={fmt.duration(t)}
                altitude={fmt.altitude(t)}
                difficulty={t.difficulty}
                price={fmt.price(t)}
                excerpt={t.excerpt}
                priority={i < 2}
              />
            </Reveal>
          ))}
        </div>
      )}
    </main>
  )
}
