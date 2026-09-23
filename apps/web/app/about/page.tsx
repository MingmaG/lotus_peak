import { JsonLd } from '@/seo/JsonLd'
import { graphForPage } from '@/seo/graph'
import type { Metadata } from 'next'
import Image from 'next/image'
import { Button, Divider, Eyebrow, Reflection, WindowFrame } from '@/design-system'
import { Prose } from '@/components/site/Prose'
import { getContent } from '@/content'
import { figurePairsFrom, pointsFrom } from '@/content/page-copy'
import { ogImage } from '@/lib/seo'
import { IMG, altFor } from '@/lib/assets'
import { Reveal } from '@/motion'
import { KeraRule, Section } from '@/sections/shared/Section'
import { InquiryButton } from '@/sections/shared/InquiryButton'

/**
 * This page keeps its own layout and takes only its words from the row.
 *
 * The alternating figure-and-copy rhythm, the `WindowFrame`, the gold dividers
 * between the commitments — those are the design, and rendering them through
 * the generic `PageBands` switch would be redrawing an approved page as a
 * worse one. What moved into the database is the copy, which is what the
 * office needed to be able to change.
 */
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/about')
  return {
    title: page?.seo.title ?? 'About',
    description:
      page?.seo.description ??
      page?.lead ??
      'Lotus Peak is a Bhutanese tour company running small-group journeys built around meditation, pilgrimage, the living arts and time with local teachers.',
    openGraph: { images: ogImage(IMG.taktshang) },
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function AboutPage() {
  const content = getContent()
  const [settings, reflections, page] = await Promise.all([
    content.settings.get(),
    content.reflections.list({ featured: false, limit: 1 }),
    content.pages.byPath('/about'),
  ])
  const reflection = reflections[0]

  /* The words, from the row. The layout below is unchanged. */
  const COMMITMENTS: [string, string][] = pointsFrom(page).map((point) => [
    point.title,
    point.body,
  ])
  const PURPOSES: [string, string, string][] = figurePairsFrom(page).map((pair) => [
    pair.title,
    pair.body,
    pair.src,
  ])

  return (
    <main>
      {/* Structured data. Every page emits one `@graph`; this is where a
          page with no entity of its own still says what it is, where it
          sits in the trail, and who publishes it. `extra` is whatever the
          office added on the SEO tab. */}
      <JsonLd
        graph={await graphForPage({
          path: '/about',
          title: page?.seo.title ?? page?.title ?? 'About',
          description: page?.seo.description ?? page?.lead ?? settings.defaultSeo.description,
          crumbs: [{ name: 'About', path: '/about' }],
          extra: page?.seo.schemaJson,
        })}
      />
      <section style={{ position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            padding: 'var(--space-8) var(--gutter) 0',
            maxWidth: 'var(--container)',
            margin: '0 auto',
          }}
        >
          {/* The design project leaves this whole block unanimated (audit B3). */}
          <Reveal>
            <Eyebrow number="About">Lotus Peak Tours &amp; Travel</Eyebrow>
            <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '18ch' }}>About Lotus Peak</h1>
          </Reveal>

          <div
            className="lp-two-col"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-9)',
              alignItems: 'start',
              marginTop: 'var(--space-8)',
            }}
          >
            <Reveal y={40}>
              <WindowFrame
                src={IMG.taktshang}
                aspectRatio="4/5"
              />
            </Reveal>

            <div style={{ paddingTop: 'var(--space-7)' }}>
              <Reveal delay={200}>
                <p style={{ fontSize: 'var(--text-lead)', lineHeight: 'var(--leading-lead)' }}>
                  We are a Bhutanese tour company. We run small-group journeys built around meditation,
                  pilgrimage and time with local teachers, in a country where the ancient practice and
                  ordinary modern life are the same thing.
                </p>
              </Reveal>
              <div style={{ display: 'grid', gap: 28, marginTop: 'var(--space-8)' }}>
                {COMMITMENTS.map(([t, b], i) => (
                  <Reveal key={t} delay={400 + i * 140}>
                    <Divider variant="gold" />
                    <h3 style={{ fontSize: 'var(--text-h3)', marginTop: 20 }}>{t}</h3>
                    <Prose html={b} compact style={{ marginTop: 10, color: 'var(--text-muted)' }} />
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section num="01" eyebrow="Our purposes" title="Three commitments">
        <div style={{ display: 'grid', gap: 'var(--space-9)', marginTop: 'var(--space-8)' }}>
          {PURPOSES.map(([t, b, img], i) => {
            const flipped = i % 2 === 1
            const copy = (
              <div>
                <h3 style={{ fontSize: 'var(--text-h2)', maxWidth: flipped ? '18ch' : '14ch' }}>{t}</h3>
                <Prose
                  html={b}
                  compact
                  style={{ marginTop: 20, color: 'var(--text-muted)', maxWidth: 'var(--measure)' }}
                />
              </div>
            )
            const image = (
              <div style={{ position: 'relative', aspectRatio: flipped ? '4/5' : '16/10' }}>
                <Image
                  src={img}
                  alt={altFor(img)}
                  fill
                  sizes="(max-width: 900px) 100vw, 45vw"
                  style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            )
            return (
              <Reveal
                key={t}
                y={40}
                className="lp-article"
                style={{
                  display: 'grid',
                  gridTemplateColumns: flipped ? '1fr 2fr' : '2fr 1fr',
                  gap: 'var(--space-9)',
                  alignItems: 'center',
                }}
              >
                {flipped ? (
                  <>
                    {copy}
                    {image}
                  </>
                ) : (
                  <>
                    {image}
                    {copy}
                  </>
                )}
              </Reveal>
            )
          })}
        </div>
      </Section>

      <KeraRule />

      <Section
        ground
        motif="thangka"
        motifSide="right"
        motifSize="40%"
        num="02"
        eyebrow="What we give back"
        title={`${settings.pledge.percent === 30 ? 'Thirty' : settings.pledge.percent} percent of our income supports ${settings.pledge.beneficiary}`}
        lead="A monastery in the hills, and the monks who keep it. It is the reason the company exists."
      >
        <div style={{ marginTop: 'var(--space-8)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Button variant="inverse" href="/trips">
            Explore trips
          </Button>
          <InquiryButton variant="ghost" style={{ color: 'var(--paper)' }}>
            Call us at {settings.contact.phone}
          </InquiryButton>
        </div>
      </Section>

      {reflection && (
        <Section num="03" eyebrow="Reflections">
          <Reveal delay={200}>
            <div style={{ marginTop: 'var(--space-8)', maxWidth: 'var(--measure)' }}>
              <Reflection quote={reflection.quote} name={reflection.name} detail={reflection.detail} />
            </div>
          </Reveal>
        </Section>
      )}
    </main>
  )
}
