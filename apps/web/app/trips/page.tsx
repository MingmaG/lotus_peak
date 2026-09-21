import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Button, Eyebrow, TrekCard } from '@/design-system'
import { getContent } from '@/content'
import { ogImage } from '@/lib/seo'
import { IMG } from '@/lib/assets'
import { fmt } from '@/content/types'
import { Reveal } from '@/motion'
import { TripFilter } from '@/sections/trips/TripFilter'
import { JsonLd } from '@/seo/JsonLd'
import { graphForTripIndex } from '@/seo/graph'

/**
 * The title and description come from this route's `Page` row.
 *
 * `generateMetadata` rather than a constant, because a constant cannot read
 * the database — which is how the contact page ended up publishing a
 * telephone number the office had already changed. What the row does not
 * override falls back to what this page shipped with.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/trips')
  const shipped: Metadata = {
  title: 'Our trips',
  description:
    'Five journeys through Bhutan: mindfulness, meditation, two around a festival, and the Jomolhari trek. Prices include all permits, meals, accommodation, the Sustainable Development Fee and a guide throughout.',
  openGraph: { images: ogImage(IMG.hike) },
  }

  return {
    ...shipped,
    title: page?.seo.title ?? page?.title ?? shipped.title,
    description: page?.seo.description ?? page?.lead ?? shipped.description,
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

/**
 * Every journey, prerendered; the filter runs in the browser.
 *
 * This page used to read `searchParams`, which made it the one route on the
 * site rendered on every request — and it is the journeys index, the page that
 * matters most to a crawler and is most often opened on a slow connection. All
 * five are in the static HTML now and `TripFilter` hides the ones that do not
 * match, which also means a crawler sees the whole catalogue whatever the URL
 * says. See the note in `src/sections/trips/TripFilter.tsx`.
 */
export default async function TripsPage() {
  const trips = await getContent().trips.list()
  const present = [...new Set(trips.map((t) => t.type))]

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
          <TripFilter present={present} />
        </Suspense>
      </Reveal>

      {/* Rendered always and hidden always, until the filter says otherwise.
          `hidden` rather than absent, because this is static HTML and there is
          no server render in which it could be decided. */}
      <div data-trip-empty hidden style={{ marginTop: 'var(--space-9)', maxWidth: 'var(--measure-narrow)' }}>
        <p style={{ fontSize: 'var(--text-lead)', color: 'var(--text-muted)' }}>
          No journeys of that kind yet. Write to us and we will build one.
        </p>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Button href="/contact">Begin a conversation</Button>
        </div>
      </div>

      {trips.length > 0 && (
        <div
          data-trip-filter="all"
          className="lp-trip-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
            gap: 'var(--space-8) var(--space-6)',
            marginTop: 'var(--space-8)',
          }}
        >
          {/**
            * The cards are not wrapped in `Reveal`, and this is the one index
            * where that is right.
            *
            * `Reveal` fades an element in when an `IntersectionObserver` first
            * sees it, and an observer does not reliably report an element that
            * was `display: none` when it becomes visible again — so a card
            * filtered out and then filtered back in could stay at `opacity: 0`
            * permanently, which is a journey nobody can read. Marking it
            * arrived from the filter does not work either: it is a DOM
            * attribute React owns and overwrites on its next render.
            *
            * Losing the stagger here costs nothing: the design project's own
            * trips index has no entrance animation on the cards at all
            * (docs/audit/effects-integration.md B2). The eyebrow, heading and
            * lead above still stage in, so the page arrives the way every
            * other page does.
            */}
          {trips.map((t, i) => (
            <div key={t.slug} data-trip-type={t.type}>
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
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
