import { VideoEmbed } from '@/components/site/VideoEmbed'
import Image from 'next/image'
import { Prose } from '@/components/site/Prose'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Badge, Button, Divider, Eyebrow, Reflection, SiteIcon, Tooltip } from '@/design-system'
import { getContent } from '@/content'
import { fmt } from '@/content/types'
import { IMG, altFor } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { Reveal } from '@/motion'
import { BandLink } from '@/sections/shared/BandCta'
import { EnquiryForm } from '@/sections/shared/EnquiryForm'
import { Centered, Fact, KeraRule, Section } from '@/sections/shared/Section'
import { SectionNav } from '@/sections/trip/SectionNav'
import { TripFaq, TripItinerary } from '@/sections/trip/TripItinerary'
import { TripGallery } from '@/sections/trip/TripGallery'
import { TripHero } from '@/sections/trip/TripHero'
import { TripRelated } from '@/sections/trip/TripRelated'
import { TripOverviewImages } from '@/sections/trip/TripOverviewImages'
import { JsonLd } from '@/seo/JsonLd'
import { graphForTrip } from '@/seo/graph'

export async function generateStaticParams() {
  return (await getContent().trips.slugs()).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const trip = await getContent().trips.bySlug(slug)
  if (!trip) return {}
  return {
    title: trip.title,
    description: trip.excerpt,
    openGraph: { title: trip.title, description: trip.excerpt, images: ogImage(trip.heroImage) },
  }
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 16 }}>
      {items.map((x) => (
        <li
          key={x}
          style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-muted)' }}
        >
          {x}
        </li>
      ))}
    </ul>
  )
}

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const content = getContent()
  const trip = await content.trips.bySlug(slug)
  if (!trip) notFound()

  const [reflections, settings] = await Promise.all([
    content.reflections.list({ featured: true, limit: 2 }),
    content.settings.get(),
  ])

  /* Hidden by the office, or nothing to show: either way there is no band,
     and the sub-nav must not offer a jump to it. */
  const showGallery = trip.sections.gallery && trip.gallery.length > 0

  const badges: [string, 'neutral' | 'pine' | 'saffron' | 'gold'][] = [
    [fmt.duration(trip), 'neutral'],
    [trip.difficulty, 'pine'],
    [`${fmt.altitude(trip)} high point`, 'neutral'],
    [trip.seasonLabel, 'saffron'],
    [trip.paceNote, 'gold'],
    /**
     * Whatever else the office added, after the five the design fixes.
     *
     * Appended rather than mixed in, so the row always opens with the same
     * five in the same order — somebody comparing two journeys is reading
     * position as much as label. All neutral: the four colours already mean
     * something here, and a sixth badge borrowing one would be claiming it.
     */
    ...trip.stats.map(
      (stat): [string, 'neutral'] => [`${stat.value} ${stat.label.toLowerCase()}`, 'neutral'],
    ),
  ]

  return (
    <main>
      <JsonLd graph={await graphForTrip(trip)} />
      <TripHero
        image={trip.heroImage}
        alt={trip.heroAlt}
        title={trip.title}
        meta={`${fmt.duration(trip)} · ${fmt.nights(trip)}`}
        regions={fmt.regions(trip)}
      />

      <SectionNav hide={showGallery ? [] : ['gallery']} />

      <Section id="overview" num="01" eyebrow="Overview" style={{ paddingBottom: 0 }}>
        <div
          className="lp-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 'var(--space-10)',
            alignItems: 'start',
            marginTop: 'var(--space-8)',
          }}
        >
          <TripOverviewImages main={trip.heroImage} inset={IMG.hike} insetAlt={altFor(IMG.hike)} />

          <div>
            <Reveal>
              <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '18ch' }}>{trip.excerpt}</h2>
            </Reveal>
            <Reveal delay={240}>
              <div>
                {trip.overview.map((p, i) => (
                  <p
                    key={i}
                    style={{
                      marginTop: i === 0 ? 28 : 20,
                      color: 'var(--text-muted)',
                      ...(i === 0
                        ? { fontSize: 'var(--text-lead)', lineHeight: 'var(--leading-lead)' }
                        : null),
                    }}
                  >
                    {p}
                  </p>
                ))}
              </div>
            </Reveal>
            <Reveal delay={480}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
                {badges.map(([label, tone]) => (
                  <Badge key={label} tone={tone}>
                    {label}
                  </Badge>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </Section>

      <Section id="highlights" style={{ paddingTop: 'var(--space-9)' }}>
        <div
          className="lp-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)',
            gap: 'var(--space-10)',
            alignItems: 'start',
          }}
        >
          <div>
            <h3 style={{ fontSize: 'var(--text-h3)' }}>At a glance</h3>
            <div
              className="lp-facts"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 40px', marginTop: 32 }}
            >
              <Fact label="Destination" value="Bhutan" />
              <Fact label="Region" value={fmt.regions(trip)} />
              <Fact label="Journey" value={trip.journeyLabel} />
              <Fact label="Length" value={fmt.length(trip)} />
              <Fact label="High point" value={fmt.altitude(trip)} />
              <Fact label="Pace" value={trip.difficulty} />
            </div>

            <div
              style={{
                marginTop: 40,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 20,
                alignItems: 'center',
                padding: 24,
                background: 'var(--surface-sunken)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <SiteIcon name="dzong" size={48} color="var(--maroon)" />
              <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0 }}>
                  From{' '}
                  <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>{fmt.price(trip)}</strong> per
                  adult, including the{' '}
                  <Tooltip label={`Sustainable Development Fee, US$${settings.sdfPerNightUsd} per night`}>
                    <span style={{ borderBottom: '1px dotted var(--border-strong)' }}>SDF</span>
                  </Tooltip>
                  .
                </p>

                {/* What the office wrote about the price, where they wrote
                    anything. Rich text, because "what it includes" is a
                    sentence with a link in it. */}
                {trip.priceNote && (
                  <Prose html={trip.priceNote} compact style={{ marginTop: 10 }} />
                )}
              </div>
            </div>

            {/**
             * The price by party size.
             *
             * Bhutan's tariff falls as a group grows, so the "from" figure
             * above is the largest group's price and is the wrong number for
             * two people travelling together — which is most of them. Shown
             * only where the office has filled the tiers in; a journey with one
             * price keeps the single line it always had.
             */}
            {trip.pricingTiers.length > 0 && (
              <Reveal>
                <table
                  className="lp-price-table"
                  style={{ marginTop: 24, width: '100%', borderCollapse: 'collapse' }}
                >
                  <caption
                    style={{
                      captionSide: 'top',
                      textAlign: 'left',
                      paddingBottom: 10,
                      fontSize: 'var(--text-label)',
                      letterSpacing: 'var(--tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Per adult, by party size
                  </caption>
                  <tbody>
                    {trip.pricingTiers.map((tier) => (
                      <tr
                        key={tier.label}
                        style={{ borderBottom: '1px solid var(--border-hairline)' }}
                      >
                        <th
                          scope="row"
                          style={{
                            textAlign: 'left',
                            fontWeight: 400,
                            padding: '10px 0',
                            verticalAlign: 'top',
                          }}
                        >
                          {tier.label}
                          {tier.note && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: 'var(--text-small)',
                                color: 'var(--text-faint)',
                              }}
                            >
                              {tier.note}
                            </span>
                          )}
                        </th>
                        <td style={{ textAlign: 'right', padding: '10px 0', whiteSpace: 'nowrap' }}>
                          {tier.wasPriceUsd !== null && (
                            <s style={{ color: 'var(--text-faint)', marginRight: 8 }}>
                              US$ {tier.wasPriceUsd.toLocaleString('en-GB')}
                            </s>
                          )}
                          US$ {tier.priceUsd.toLocaleString('en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Reveal>
            )}
          </div>

          <div>
            <Reveal>
              <h3 style={{ fontSize: 'var(--text-h3)' }}>Highlights</h3>
            </Reveal>
            <ul style={{ margin: '32px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 22 }}>
              {trip.highlights.map((h, i) => (
                <Reveal
                  as="li"
                  key={h}
                  delay={i * 140}
                  y={18}
                  style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 20, alignItems: 'baseline' }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: 20,
                      borderTop: '1px solid var(--saffron)',
                      transform: 'translateY(-4px)',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>{h}</span>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <KeraRule />

      <Section id="enquiry" style={{ background: 'var(--surface-sunken)' }}>
        <div
          className="lp-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)',
            gap: 'var(--space-10)',
            alignItems: 'start',
          }}
        >
          <div>
            <Eyebrow number="02">Enquiry</Eyebrow>
            <h2 style={{ fontSize: 'var(--text-h2)', marginTop: 20, maxWidth: '14ch' }}>
              We are here to help you on your way
            </h2>
            <div style={{ display: 'grid', gap: 20, marginTop: 36 }}>
              {(
                [
                  ['Call', settings.contact.phone],
                  ['Write', settings.contact.email],
                  ['Reply', settings.contact.replyPromise],
                ] as const
              ).map(([t, b]) => (
                <div key={t} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 16 }}>
                  <Eyebrow tone="muted" style={{ paddingTop: 4 }}>
                    {t}
                  </Eyebrow>
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <Divider variant="gold" style={{ margin: '36px 0' }} />
            <p style={{ color: 'var(--text-muted)' }}>
              Departures are small and few. If you have a date in mind, tell us and we will build the journey
              around it. No deposit, no obligation. Just a reply.
            </p>
          </div>

          <EnquiryForm source="trip-detail" fixedTrip={{ slug: trip.slug, title: trip.title }} />
        </div>
      </Section>

      <BandLink
        href="/trips"
        src={IMG.hike}
        height="80vh"
        eyebrow="On the trail"
        title="Walked at a pace that leaves room to notice"
        body="Two nights in most valleys. Drives of no more than five hours. A rest day written in. Your guide sets the pace to the slowest step in the group."
      />

      <Section id="itinerary">
        <Reveal>
          <Centered eyebrow="Itinerary" title="Your days, one by one" />
        </Reveal>
        <TripItinerary days={trip.itinerary} />

        {/**
         * The route, as the office's own drawing.
         *
         * Under the itinerary rather than beside it: on a phone a map beside
         * eleven days of copy is a map nobody scrolls back up to, and this is
         * the point at which somebody has just read where they are going.
         */}
        {trip.routeMap && (
          <Reveal>
            <figure style={{ margin: 'var(--space-9) auto 0', maxWidth: 900 }}>
              <Image
                src={trip.routeMap}
                alt={trip.routeMapAlt ?? `The route of ${trip.title}, drawn on a map`}
                width={1600}
                height={1000}
                sizes="(max-width: 900px) 100vw, 900px"
                style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)' }}
              />
            </figure>
          </Reveal>
        )}

        {/**
         * The walking profile.
         *
         * Drawn as a definition list rather than a chart: it is eight to twelve
         * numbers, a chart of that many points is a picture of a table, and a
         * table is something a screen reader can read out.
         */}
        {trip.elevationProfile.length > 0 && (
          <Reveal>
            <div style={{ margin: 'var(--space-9) auto 0', maxWidth: 820 }}>
              <h3
                style={{
                  fontSize: 'var(--text-label)',
                  letterSpacing: 'var(--tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: 16,
                }}
              >
                Where you sleep, and how high
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {trip.elevationProfile.map((point) => (
                    <tr
                      key={`${point.day}-${point.label}`}
                      style={{ borderBottom: '1px solid var(--border-hairline)' }}
                    >
                      <th
                        scope="row"
                        style={{
                          textAlign: 'left',
                          fontWeight: 400,
                          padding: '10px 0',
                          width: '5em',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Day {point.day}
                      </th>
                      <td style={{ padding: '10px 0' }}>{point.label}</td>
                      <td
                        style={{
                          padding: '10px 0',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {point.metres.toLocaleString('en-GB')} m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        )}
      </Section>

      <KeraRule />

      <Section id="included" num="03" eyebrow="Included">
        <div
          className="lp-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 'var(--space-10)',
            marginTop: 'var(--space-8)',
          }}
        >
          <div>
            <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: 28 }}>What is included</h3>
            <List items={trip.included} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--text-h3)', marginBottom: 28 }}>What is not</h3>
            <List items={trip.excluded} />
          </div>
        </div>
      </Section>

      {/**
       * The film, where there is one.
       *
       * After the gallery: somebody who has read the itinerary and looked at
       * the photographs is the person who will watch it, and a film above the
       * fold is a film that loads for everybody who does not.
       */}
      {trip.videoUrl && (
        <Section>
          <Reveal>
            <div style={{ maxWidth: 900, margin: '0 auto' }} className="lp-prose">
              <VideoEmbed url={trip.videoUrl} title={`${trip.title} — a film`} />
            </div>
          </Reveal>
        </Section>
      )}

      {showGallery && (
        <Section id="gallery" style={{ paddingTop: 0 }}>
          <Reveal>
            <Centered eyebrow="Photographs" title="What the days look like" />
          </Reveal>
          <div style={{ maxWidth: 'var(--container)', margin: 'var(--space-8) auto 0' }}>
            <TripGallery photos={trip.gallery} title={trip.title} />
          </div>
        </Section>
      )}

      <Section id="essential" style={{ paddingTop: 0 }}>
        <Reveal>
          <Centered eyebrow="Questions" title="Essential information" />
        </Reveal>
        <Reveal delay={300}>
          <div style={{ marginTop: 'var(--space-8)' }}>
            <TripFaq items={trip.faq} groups={trip.faqGroups} />
          </div>
        </Reveal>
      </Section>

      <KeraRule />

      <Section id="reflections" num="04" eyebrow="Reflections">
        <div
          className="lp-two-col"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-9)',
            marginTop: 'var(--space-8)',
          }}
        >
          {reflections.map((r, i) => (
            <Reveal key={r.id} delay={i * 320}>
              <Reflection quote={r.quote} name={r.name} detail={r.detail} />
            </Reveal>
          ))}
        </div>
        <Reveal delay={400}>
          <div
            style={{
              marginTop: 'var(--space-9)',
              display: 'flex',
              gap: 24,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Button href="/contact">Begin a conversation</Button>
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
              From {fmt.price(trip)} per adult
            </span>
          </div>
        </Reveal>
      </Section>

      <TripRelated trip={trip} />
    </main>
  )
}
