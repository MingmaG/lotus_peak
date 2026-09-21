import { Prose } from '@/components/site/Prose'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow, SiteIcon } from '@/design-system'
import { getContent } from '@/content'
import { fmt } from '@/content/types'
import { IMG, altFor } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { Parallax, Reveal, ScrollCue } from '@/motion'
import { BandLink } from '@/sections/shared/BandCta'
import { heroOffset } from '@/sections/shared/Section'

/**
 * The title and description come from this route's `Page` row.
 *
 * `generateMetadata` rather than a constant, because a constant cannot read
 * the database — which is how the contact page ended up publishing a
 * telephone number the office had already changed. What the row does not
 * override falls back to what this page shipped with.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/destinations')
  const shipped: Metadata = {
  title: 'Where we go',
  description:
    'Paro, Thimphu, Punakha, Bumthang, Trongsa and Phobjikha — the six valleys our journeys move through, and what is in each of them.',
  openGraph: { images: ogImage(IMG.paroDzong) },
  }

  return {
    ...shipped,
    title: page?.seo.title ?? page?.title ?? shipped.title,
    description: page?.seo.description ?? page?.lead ?? shipped.description,
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function DestinationsPage() {
  const content = getContent()
  const [destinations, trips] = await Promise.all([content.destinations.list(), content.trips.list()])
  const bySlug = new Map(trips.map((t) => [t.slug, t]))

  return (
    <main>
      <Parallax
        src={IMG.paroDzong}
        alt={altFor(IMG.paroDzong)}
        speed={0.6}
        priority
        style={{ height: '82svh', minHeight: 560, display: 'flex', alignItems: 'flex-end', ...heroOffset }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top,rgba(31,29,26,.78),rgba(31,29,26,.12) 55%,rgba(31,29,26,.3))',
          }}
        />
        <div
          style={{
            position: 'relative',
            padding: '0 var(--gutter) var(--space-8)',
            maxWidth: 'var(--container)',
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
            color: 'var(--paper)',
            display: 'grid',
            gap: 24,
          }}
        >
          <Reveal>
            <Eyebrow tone="inverse">Where we go</Eyebrow>
          </Reveal>
          <Reveal delay={240}>
            <h1 style={{ fontSize: 'var(--text-display)', lineHeight: 1, maxWidth: '14ch' }}>Six valleys</h1>
          </Reveal>
          <Reveal delay={520}>
            <p
              style={{
                fontSize: 'var(--text-lead)',
                lineHeight: 'var(--leading-lead)',
                maxWidth: 'var(--measure-narrow)',
                color: 'rgba(255,255,255,.85)',
              }}
            >
              Bhutan is small and the roads are slow. We would rather stay two nights in a valley than pass
              through four.
            </p>
          </Reveal>
          <Reveal delay={800}>
            <div style={{ marginTop: 8 }}>
              <ScrollCue />
            </div>
          </Reveal>
        </div>
      </Parallax>

      <section style={{ position: 'relative', padding: 'var(--space-9) var(--gutter) var(--space-10)' }}>
        <div
          style={{
            position: 'relative',
            maxWidth: 'var(--container)',
            margin: '0 auto',
            display: 'grid',
            gap: 'var(--space-11)',
          }}
        >
          {destinations.map((destination, i) => {
            const flipped = i % 2 === 1
            const journeys = destination.tripSlugs
              .map((slug) => bySlug.get(slug))
              .filter((trip) => trip !== undefined)

            return (
              <article
                key={destination.slug}
                id={destination.slug}
                className="lp-article"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-9)',
                  alignItems: 'center',
                  direction: flipped ? 'rtl' : 'ltr',
                }}
              >
                <Reveal y={40} style={{ direction: 'ltr' }}>
                  <Parallax
                    src={destination.image}
                    alt={destination.imageAlt}
                    speed={0.5}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    style={{ aspectRatio: flipped ? '4/5' : '3/2', borderRadius: 'var(--radius-sm)' }}
                  />
                </Reveal>

                <div style={{ direction: 'ltr' }}>
                  <Reveal delay={240}>
                    <SiteIcon name={destination.icon} size={40} color="var(--maroon)" />
                    <h2 style={{ fontSize: 'var(--text-h1)', marginTop: 20 }}>{destination.name}</h2>
                  </Reveal>
                  <Reveal delay={480}>
                    <p
                      style={{
                        marginTop: 20,
                        color: 'var(--text-muted)',
                        maxWidth: 'var(--measure)',
                        fontSize: 'var(--text-lead)',
                        lineHeight: 'var(--leading-lead)',
                      }}
                    >
                      <Prose html={destination.detail} compact />
                    </p>
                  </Reveal>

                  {journeys.length > 0 && (
                    <Reveal delay={640}>
                      <div style={{ marginTop: 'var(--space-6)' }}>
                        <Eyebrow tone="muted">Journeys that go there</Eyebrow>
                        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid' }}>
                          {journeys.map((trip) => (
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
                      </div>
                    </Reveal>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <BandLink
        href="/trips"
        src={IMG.phobjikhaValley}
        height="72vh"
        eyebrow="Put them together"
        title="Most journeys take in three or four of these"
        body="Eleven days for the valleys, seven for the festival week, fifteen for the trek."
        cta="See the journeys"
      />
    </main>
  )
}
