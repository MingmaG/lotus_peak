import { JsonLd } from '@/seo/JsonLd'
import { graphForPage } from '@/seo/graph'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Eyebrow, SiteIcon } from '@/design-system'
import { getContent } from '@/content'
import { fmt } from '@/content/types'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { Parallax, Reveal } from '@/motion'
import { BandInquiry } from '@/sections/shared/BandCta'

/**
 * The title and description come from this route's `Page` row.
 *
 * `generateMetadata` rather than a constant, because a constant cannot read
 * the database — which is how the contact page ended up publishing a
 * telephone number the office had already changed. What the row does not
 * override falls back to what this page shipped with.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/activities')
  const shipped: Metadata = {
  title: 'What you can do',
  description:
    'Cultural and historical, mindfulness and retreat, nature and walking — the three kinds of day our journeys are built from, and which journeys carry them.',
  openGraph: { images: ogImage(IMG.meditation) },
  }

  return {
    ...shipped,
    title: page?.seo.title ?? page?.title ?? shipped.title,
    description: page?.seo.description ?? page?.lead ?? shipped.description,
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function ActivitiesPage() {

  /* The row behind this page: its SEO overrides and any JSON-LD the
     office added. Both are also read in `generateMetadata`, which Next
     runs separately — the provider's fetch is tagged and cached, so this
     is one request, not two. */
  const page = await getContent().pages.byPath('/activities')
  const settings = await getContent().settings.get()
  const content = getContent()
  const [activities, trips] = await Promise.all([content.activities.list(), content.trips.list()])
  const bySlug = new Map(trips.map((t) => [t.slug, t]))

  return (
    <main>
      {/* Structured data. Every page emits one `@graph`; this is where a
          page with no entity of its own still says what it is, where it
          sits in the trail, and who publishes it. `extra` is whatever the
          office added on the SEO tab. */}
      <JsonLd
        graph={await graphForPage({
          path: '/activities',
          title: page?.seo.title ?? page?.title ?? 'What you can do',
          description: page?.seo.description ?? page?.lead ?? settings.defaultSeo.description,
          crumbs: [{ name: 'What you can do', path: '/activities' }],
          extra: page?.seo.schemaJson,
        })}
      />
      {/* The band at the foot of the page is full-bleed, so the container sits
          on this wrapper rather than on <main>. */}
      <div
        style={{
          position: 'relative',
          padding: 'var(--space-8) var(--gutter) 0',
          maxWidth: 'var(--container)',
          margin: '0 auto',
        }}
      >
        <Reveal>
          <Eyebrow number="Activities">What you can do</Eyebrow>
          <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '20ch' }}>
            Three kinds of day
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
            Every journey holds some of all three. The difference between them is the proportion, and how
            far you walk.
          </p>
        </Reveal>

        <div style={{ display: 'grid', gap: 'var(--space-11)', margin: 'var(--space-9) 0 var(--space-10)' }}>
          {activities.map((activity, i) => {
            const flipped = i % 2 === 1
            const journeys = activity.tripSlugs
              .map((slug) => bySlug.get(slug))
              .filter((trip) => trip !== undefined)

            return (
              <article
                key={activity.slug}
                id={activity.slug}
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
                    src={activity.image}
                    alt={activity.imageAlt}
                    speed={0.5}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    style={{ aspectRatio: flipped ? '4/5' : '3/2', borderRadius: 'var(--radius-sm)' }}
                  />
                </Reveal>

                <div style={{ direction: 'ltr' }}>
                  <Reveal delay={240}>
                    <SiteIcon name={activity.icon} size={40} color="var(--maroon)" />
                    <h2 style={{ fontSize: 'var(--text-h2)', marginTop: 20, maxWidth: '16ch' }}>
                      {activity.name}
                    </h2>
                  </Reveal>

                  <Reveal delay={420}>
                    <p
                      style={{
                        marginTop: 20,
                        color: 'var(--text-muted)',
                        maxWidth: 'var(--measure)',
                        fontSize: 'var(--text-lead)',
                        lineHeight: 'var(--leading-lead)',
                      }}
                    >
                      {activity.blurb}
                    </p>
                  </Reveal>

                  <Reveal delay={580}>
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: 'var(--space-6) 0 0',
                        padding: 0,
                        display: 'grid',
                        gap: 12,
                        maxWidth: 'var(--measure)',
                      }}
                    >
                      {activity.examples.map((example) => (
                        <li key={example} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 14 }}>
                          <span aria-hidden="true" style={{ color: 'var(--gold)' }}>
                            ·
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{example}</span>
                        </li>
                      ))}
                    </ul>
                  </Reveal>

                  {journeys.length > 0 && (
                    <Reveal delay={720}>
                      <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {journeys.map((trip) => (
                          <Link
                            key={trip.slug}
                            href={`/trips/${trip.slug}`}
                            style={{
                              padding: '8px 16px',
                              border: '1px solid var(--border-gold)',
                              borderRadius: 'var(--radius-pill)',
                              textDecoration: 'none',
                              color: 'inherit',
                              fontSize: 'var(--text-small)',
                            }}
                          >
                            {trip.title.split(':')[0]} · {fmt.duration(trip)}
                          </Link>
                        ))}
                      </div>
                    </Reveal>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <BandInquiry
        src={IMG.uphill}
        height="66vh"
        eyebrow="Or none of the above"
        title="Tell us which of these you want more of"
        body="Departures are small, so the balance of a week can shift. More sitting, more walking, or more time doing nothing at all."
      />
    </main>
  )
}
