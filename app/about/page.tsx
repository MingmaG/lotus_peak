import type { Metadata } from 'next'
import Image from 'next/image'
import { Button, Divider, Eyebrow, Reflection, WindowFrame } from '@/design-system'
import { getContent } from '@/content'
import { ogImage } from '@/lib/seo'
import { IMG, altFor } from '@/lib/assets'
import { Reveal } from '@/motion'
import { KeraRule, Section } from '@/sections/shared/Section'
import { InquiryButton } from '@/sections/shared/InquiryButton'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Lotus Peak is a Bhutanese tour company running small-group journeys built around meditation, pilgrimage and time with local teachers.',
  openGraph: { images: ogImage(IMG.taktshang) },
}

const COMMITMENTS: [string, string][] = [
  ['Mindfulness guide', 'We teach meditation as a lifelong skill. It opens the mind to see the world as it is.'],
  ['Peaceful journey', 'Loving compassion opens the heart. We travel that way, and so will you.'],
]

const PURPOSES: [string, string, string][] = [
  [
    'Mindful travel.',
    'Each journey is designed around intention and awareness, connecting you with Bhutan’s landscapes and living traditions.',
    IMG.hike,
  ],
  [
    'Guided by teachers.',
    'Journeys are shaped with Rinpoches and Lams: meditation in monasteries, pilgrimage walks and time in silence.',
    IMG.chorten,
  ],
  [
    'Living arts.',
    'Jomzo is the Bhutanese art of sculpting clay, copper and gold. Watch artisans at work and take part yourself.',
    IMG.tashichho,
  ],
]

export default async function AboutPage() {
  const content = getContent()
  const [settings, reflections] = await Promise.all([
    content.settings.get(),
    content.reflections.list({ featured: false, limit: 1 }),
  ])
  const reflection = reflections[0]

  return (
    <main>
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
                  pilgrimage and time with local teachers.
                </p>
              </Reveal>
              <div style={{ display: 'grid', gap: 28, marginTop: 'var(--space-8)' }}>
                {COMMITMENTS.map(([t, b], i) => (
                  <Reveal key={t} delay={400 + i * 140}>
                    <Divider variant="gold" />
                    <h3 style={{ fontSize: 'var(--text-h3)', marginTop: 20 }}>{t}</h3>
                    <p style={{ marginTop: 10, color: 'var(--text-muted)' }}>{b}</p>
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
                <p style={{ marginTop: 20, color: 'var(--text-muted)', maxWidth: 'var(--measure)' }}>{b}</p>
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
