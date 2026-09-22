import { Prose } from '@/components/site/Prose'
import Image from 'next/image'
import { Button, Divider, Eyebrow, Reflection, SiteIcon, TrekCard } from '@/design-system'
import { getContent } from '@/content'
import { fmt, type PageBand, type Reflection as ReflectionData, type Trip } from '@/content/types'
import { Reveal, Strip } from '@/motion'
import { BandLink } from './BandCta'
import { Section } from './Section'

/**
 * An editorial page's bands, drawn.
 *
 * The other half of the Pages screen: the admin panel offers ten kinds of
 * band, and this is the switch that renders each one **through the existing
 * design system**. Nothing here invents a layout — every band is composed from
 * `Eyebrow`, `Divider`, `SiteIcon`, `TrekCard`, `Reflection`, `Strip` and the
 * two `Section` helpers, which is what keeps a page somebody assembled in the
 * admin panel looking like a page somebody designed.
 *
 * The switch is exhaustive and TypeScript checks that it is, so adding a band
 * type to the union is a change the compiler insists on finishing here.
 *
 * ## Why this is a server component
 *
 * Three of the bands reference other content — journeys, reflections, people —
 * and resolve it themselves. Doing that on the server means the page arrives
 * complete, with no request waterfall and nothing rendered from `undefined`
 * while it waits.
 */
export async function PageBands({
  bands,
  /**
   * The page's own photograph, for a `cta` band drawn on the dark band.
   *
   * The design's closing band is a photograph with text over it, and the
   * stored section carries no image of its own — deliberately, because a page
   * has one hero and a second image chooser on every call to action would be
   * one more thing to get wrong. A page with no hero gets the plain treatment
   * instead of a band with nothing behind it.
   */
  heroImage,
  heroAlt,
}: {
  bands: PageBand[]
  heroImage?: string | null
  heroAlt?: string
}) {
  /**
   * The content three of the bands might need, fetched once.
   *
   * Asked for up front rather than inside each band, so a page with a journeys
   * band and a reflections band makes two reads rather than two per band. The
   * repository is cached per request underneath, so asking for something no
   * band uses costs one fetch that Next has already made for the layout.
   */
  const needsTrips = bands.some((band) => band.kind === 'trips')
  const needsReflections = bands.some((band) => band.kind === 'reflections')
  const needsPeople = bands.some((band) => band.kind === 'people')

  const content = getContent()
  const [trips, reflections, people] = await Promise.all([
    needsTrips ? content.trips.list() : Promise.resolve([]),
    needsReflections ? content.reflections.list() : Promise.resolve([]),
    needsPeople ? content.people.list() : Promise.resolve([]),
  ])

  return (
    <>
      {bands.map((band, index) => (
        <Band
          key={index}
          band={band}
          index={index}
          trips={trips}
          reflections={reflections}
          people={people}
          heroImage={heroImage ?? null}
          heroAlt={heroAlt}
        />
      ))}
    </>
  )
}

function Band({
  band,
  index,
  trips,
  reflections,
  people,
  heroImage,
  heroAlt,
}: {
  band: PageBand
  index: number
  trips: Trip[]
  reflections: ReflectionData[]
  people: Awaited<ReturnType<ReturnType<typeof getContent>['people']['list']>>
  heroImage: string | null
  heroAlt?: string
}) {
  switch (band.kind) {
    case 'prose':
      return (
        <Section>
          <Reveal>
            {band.eyebrow && <Eyebrow number={pad(index)}>{band.eyebrow}</Eyebrow>}
            {band.title && (
              <h2 style={{ fontSize: 'var(--text-h2)', marginTop: band.eyebrow ? 20 : 0, maxWidth: '20ch' }}>
                {band.title}
              </h2>
            )}
          </Reveal>
          <Reveal delay={200}>
            {/**
             * Already sanitised, by the mapper that read it.
             *
             * `toBand` runs `renderStoredRichText` over every rich-text field
             * on its way out of the provider — see the note there. Doing it
             * again here would be wasted work on a string that is already
             * rebuilt, and a second pass over a film's façade markup is a
             * chance to damage it.
             */}
            <Prose html={band.body} style={{ marginTop: 20, maxWidth: 'var(--measure)' }} />
          </Reveal>
        </Section>
      )

    case 'points':
      return (
        <Section>
          <Reveal>
            {band.eyebrow && <Eyebrow number={pad(index)}>{band.eyebrow}</Eyebrow>}
            {band.title && (
              <h2 style={{ fontSize: 'var(--text-h2)', marginTop: 20, maxWidth: '18ch' }}>
                {band.title}
              </h2>
            )}
            {band.lead && (
              <p
                style={{
                  marginTop: 20,
                  fontSize: 'var(--text-lead)',
                  lineHeight: 'var(--leading-lead)',
                  maxWidth: 'var(--measure-narrow)',
                  color: 'var(--text-muted)',
                }}
              >
                {band.lead}
              </p>
            )}
          </Reveal>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 'var(--space-7)',
              marginTop: 'var(--space-8)',
            }}
          >
            {band.points.map((point, i) => (
              <Reveal key={point.title} delay={250 + i * 120}>
                {point.icon ? (
                  <SiteIcon name={point.icon} size={40} />
                ) : (
                  <Divider variant="gold" />
                )}
                <h3 style={{ marginTop: 16, fontSize: 'var(--text-h4)' }}>{point.title}</h3>
                <Prose html={point.body} compact style={{ marginTop: 10, color: 'var(--text-muted)' }} />
              </Reveal>
            ))}
          </div>
        </Section>
      )

    case 'facts':
      return (
        <Section>
          <Reveal>
            {band.title && <Eyebrow tone="muted">{band.title}</Eyebrow>}
            {/**
             * A real definition list.
             *
             * Not a table and not a grid of divs: a fact in a `<dl>` is a fact
             * an assistant can lift, and one in a styled paragraph is a fact it
             * has to infer. That is the whole reason this band exists.
             */}
            <dl
              style={{
                margin: '18px 0 0',
                display: 'grid',
                gap: 0,
                maxWidth: 'var(--measure)',
              }}
            >
              {band.rows.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px,1fr) 2fr',
                    gap: 'var(--space-5)',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <dt style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>
                    {label}
                  </dt>
                  <dd style={{ margin: 0 }}>{value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </Section>
      )

    case 'faq':
      return (
        <Section>
          <Reveal>
            {band.title && (
              <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '18ch' }}>{band.title}</h2>
            )}
          </Reveal>
          <div style={{ marginTop: 'var(--space-7)', maxWidth: 'var(--measure)' }}>
            {band.items.map((item, i) => (
              <Reveal key={item.question} delay={120 + i * 80}>
                <div style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}>
                  <h3 style={{ fontSize: 'var(--text-h4)' }}>{item.question}</h3>
                  <Prose html={item.answer} compact style={{ marginTop: 10, color: 'var(--text-muted)' }} />
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )

    case 'figure':
      return (
        <Section>
          <Reveal>
            <figure style={{ margin: 0 }}>
              <div
                style={{
                  position: 'relative',
                  aspectRatio: band.width === 'full' ? '21/9' : '3/2',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={band.src}
                  alt={band.alt ?? ''}
                  aria-hidden={band.alt ? undefined : true}
                  fill
                  sizes={band.width === 'full' ? '100vw' : '(max-width: 900px) 100vw, 70vw'}
                  style={{ objectFit: 'cover' }}
                />
              </div>
              {band.caption && (
                <figcaption
                  style={{
                    marginTop: 12,
                    fontSize: 'var(--text-small)',
                    color: 'var(--text-muted)',
                    maxWidth: 'var(--measure-narrow)',
                  }}
                >
                  {band.caption}
                </figcaption>
              )}
            </figure>
          </Reveal>
        </Section>
      )

    case 'gallery':
      return (
        <>
          {band.title && (
            <Section>
              <Reveal>
                <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '18ch' }}>{band.title}</h2>
              </Reveal>
            </Section>
          )}
          <Strip images={band.items} />
        </>
      )

    case 'reflections': {
      /* Empty means the featured ones, which is what the design's bands do. */
      const chosen =
        band.reflectionIds.length > 0
          ? band.reflectionIds
              .map((id) => reflections.find((row) => row.id === id))
              .filter((row): row is ReflectionData => row !== undefined)
          : reflections.filter((row) => row.featured)

      if (chosen.length === 0) return null

      return (
        <Section>
          {band.title && (
            <Reveal>
              <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '18ch' }}>{band.title}</h2>
            </Reveal>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: 'var(--space-8)',
              marginTop: band.title ? 'var(--space-8)' : 0,
            }}
          >
            {chosen.map((row, i) => (
              <Reveal key={row.id} delay={i * 180}>
                <Reflection quote={row.quote} name={row.name} detail={row.detail} />
              </Reveal>
            ))}
          </div>
        </Section>
      )
    }

    case 'trips': {
      /* Empty means the catalogue in its own order. */
      const chosen =
        band.tripSlugs.length > 0
          ? band.tripSlugs
              .map((slug) => trips.find((trip) => trip.slug === slug))
              .filter((trip): trip is Trip => trip !== undefined)
          : trips.slice(0, 4)

      if (chosen.length === 0) return null

      return (
        <Section>
          <Reveal>
            {band.title && (
              <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '18ch' }}>{band.title}</h2>
            )}
            {band.lead && (
              <p style={{ marginTop: 16, color: 'var(--text-muted)', maxWidth: 'var(--measure-narrow)' }}>
                {band.lead}
              </p>
            )}
          </Reveal>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 'var(--space-7)',
              marginTop: 'var(--space-8)',
            }}
          >
            {chosen.map((trip, i) => (
              <Reveal key={trip.slug} delay={i * 200} y={40}>
                <TrekCard
                  href={`/trips/${trip.slug}`}
                  image={trip.heroImage}
                  imageAlt={trip.heroAlt}
                  region={fmt.regionsShort(trip)}
                  title={trip.title}
                  days={fmt.duration(trip)}
                  altitude={fmt.altitude(trip)}
                  difficulty={trip.difficulty}
                  price={fmt.price(trip)}
                  sizes="(max-width: 900px) 100vw, 30vw"
                />
              </Reveal>
            ))}
          </div>
        </Section>
      )
    }

    case 'people': {
      const chosen =
        band.personIds.length > 0
          ? band.personIds
              .map((id) => people.find((row) => row.id === id))
              .filter((row): row is (typeof people)[number] => row !== undefined)
          : people

      if (chosen.length === 0) return null

      return (
        <Section>
          <Reveal>
            {band.title && (
              <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '18ch' }}>{band.title}</h2>
            )}
            {band.lead && (
              <p style={{ marginTop: 16, color: 'var(--text-muted)', maxWidth: 'var(--measure-narrow)' }}>
                {band.lead}
              </p>
            )}
          </Reveal>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 'var(--space-8)',
              marginTop: 'var(--space-8)',
            }}
          >
            {chosen.map((person, i) => (
              <Reveal key={person.id} delay={i * 140}>
                {person.photo && (
                  <div
                    style={{
                      position: 'relative',
                      aspectRatio: '4/5',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      src={person.photo}
                      alt={person.photoAlt ?? ''}
                      fill
                      sizes="(max-width: 900px) 50vw, 25vw"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                )}
                <h3 style={{ marginTop: 16, fontSize: 'var(--text-h4)' }}>{person.name}</h3>
                <p style={{ marginTop: 4, fontSize: 'var(--text-small)', color: 'var(--gold)' }}>
                  {person.role}
                </p>
                <Prose html={person.bio} compact style={{ marginTop: 10, color: 'var(--text-muted)' }} />
              </Reveal>
            ))}
          </div>
        </Section>
      )
    }

    case 'cta':
      /**
       * On the dark band, or plain.
       *
       * `BandLink` is the design's own closing band and carries the single
       * filled button the rules allow per section — which is why a page may
       * have several `cta` bands and each one still obeys the rule.
       */
      return band.band && heroImage ? (
        <BandLink
          src={heroImage}
          alt={heroAlt ?? ''}
          title={band.title}
          body={band.lead ?? ''}
          cta={band.label}
          href={band.href}
          height="70vh"
        />
      ) : (
        <Section>
          <Reveal>
            <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '18ch' }}>{band.title}</h2>
            {band.lead && (
              <p style={{ marginTop: 16, color: 'var(--text-muted)', maxWidth: 'var(--measure-narrow)' }}>
                {band.lead}
              </p>
            )}
            <div style={{ marginTop: 'var(--space-7)' }}>
              <Button href={band.href}>{band.label}</Button>
            </div>
          </Reveal>
        </Section>
      )
  }
}

/** "01", "02" — the eyebrow's numbering, as the design writes it. */
function pad(index: number): string {
  return String(index + 1).padStart(2, '0')
}
