import type { Metadata } from 'next'
import { Eyebrow, SiteIcon } from '@/design-system'
import { getContent } from '@/content'
import { ogImage } from '@/lib/seo'
import { IMG } from '@/lib/assets'
import { Parallax, Reveal, ScrollCue } from '@/motion'
import { BandLink } from '@/sections/shared/BandCta'
import { heroOffset } from '@/sections/shared/Section'

export const metadata: Metadata = {
  title: 'Culture',
  description:
    'Tshechu, dzongs, textiles, Jomzo and the thirteen arts, Gross National Happiness, kira and gho, archery, and what is on the table — what you will see on a journey with us, and a little of what it means.',
  openGraph: { images: ogImage(IMG.tshechu) },
}

export default async function CulturePage() {
  const articles = await getContent().culture.list()

  return (
    <main>
      <Parallax
        src={IMG.tashichho}
        speed={0.6}
        priority
        style={{ height: '92svh', minHeight: 600, display: 'flex', alignItems: 'flex-end', ...heroOffset }}
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
            <Eyebrow tone="inverse">Culture · Bhutanese traditions</Eyebrow>
          </Reveal>
          <Reveal delay={240}>
            <h1 style={{ fontSize: 'var(--text-display)', lineHeight: 1, maxWidth: '14ch' }}>
              A culture that is still in use
            </h1>
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
              What you will see on a journey with us, and a little of what it means.
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
          {articles.map((a, i) => {
            const flipped = i % 2 === 1
            return (
              <article
                key={a.slug}
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
                    src={a.image}
                    speed={0.5}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    style={{ aspectRatio: flipped ? '4/5' : '3/2', borderRadius: 'var(--radius-sm)' }}
                  />
                </Reveal>
                <div style={{ direction: 'ltr' }}>
                  <Reveal delay={240}>
                    <SiteIcon name={a.icon} size={40} color="var(--maroon)" />
                    <h2 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '14ch' }}>{a.title}</h2>
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
                      {a.body}
                    </p>
                  </Reveal>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <BandLink
        href="/trips/tshechu"
        src={IMG.chamMaskedDance}
        height="76vh"
        eyebrow="See it"
        title="Festival journeys are timed to a tshechu"
        body="Seven days around Paro Tshechu, then out to Phobjikha for the quiet. Or five, in Thimphu or Punakha."
        cta="See the festival journeys"
      />
    </main>
  )
}
