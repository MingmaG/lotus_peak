import { JsonLd } from '@/seo/JsonLd'
import { graphForIndex } from '@/seo/graph'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button, Eyebrow, SiteIcon } from '@/design-system'
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
    'Paro, Thimphu, Punakha, Bumthang, Trongsa and Phobjikha: the six valleys our journeys move through, and the places in each of them.',
  alternates: { canonical: '/destinations' },
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

  /* The row behind this page: its SEO overrides and any JSON-LD the
     office added. Both are also read in `generateMetadata`, which Next
     runs separately — the provider's fetch is tagged and cached, so this
     is one request, not two. */
  const page = await getContent().pages.byPath('/destinations')
  const settings = await getContent().settings.get()
  const content = getContent()
  const [all, trips] = await Promise.all([content.destinations.list(), content.trips.list()])
  const bySlug = new Map(trips.map((t) => [t.slug, t]))
  /* The valleys. Each one's places are listed under it and have pages of
     their own beneath its page. */
  const destinations = all.filter((d) => d.parentSlug === null)

  return (
    <main>
      {/* Structured data. Every page emits one `@graph`; this is where a
          page with no entity of its own still says what it is, where it
          sits in the trail, and who publishes it. `extra` is whatever the
          office added on the SEO tab. */}
      <JsonLd
        graph={await graphForIndex({
          path: '/destinations',
          title: page?.seo.title ?? page?.title ?? 'Where we go',
          description: page?.seo.description ?? page?.lead ?? settings.defaultSeo.description,
          crumbs: [{ name: 'Where we go', path: '/destinations' }],
          items: all.map((d) => ({ path: d.path, name: d.name })),
          extra: page?.seo.schemaJson,
        })}
      />
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
                    <h2 style={{ fontSize: 'var(--text-h1)', marginTop: 20 }}>
                      <Link href={destination.path} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {destination.name}
                      </Link>
                    </h2>
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
                      {destination.standfirst || destination.blurb}
                    </p>
                  </Reveal>

                  {destination.places.length > 0 && (
                    <Reveal delay={560}>
                      <div style={{ marginTop: 'var(--space-6)' }}>
                        <Eyebrow tone="muted">Places in {destination.name}</Eyebrow>
                        <ul
                          style={{
                            listStyle: 'none',
                            margin: '16px 0 0',
                            padding: 0,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 12,
                          }}
                        >
                          {destination.places.map((place) => (
                            <li key={place.slug}>
                              <Link
                                href={place.path}
                                style={{
                                  display: 'inline-block',
                                  padding: '8px 16px',
                                  border: '1px solid var(--border-gold)',
                                  borderRadius: 'var(--radius-pill)',
                                  textDecoration: 'none',
                                  color: 'inherit',
                                  fontSize: 'var(--text-small)',
                                }}
                              >
                                {place.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Reveal>
                  )}

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

                  <Reveal delay={720}>
                    <div style={{ marginTop: 'var(--space-6)' }}>
                      <Button href={destination.path} variant="outline" size="sm">
                        About {destination.name}
                      </Button>
                    </div>
                  </Reveal>
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
