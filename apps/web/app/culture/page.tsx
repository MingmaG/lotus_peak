import { JsonLd } from '@/seo/JsonLd'
import { graphForIndex } from '@/seo/graph'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Button, Eyebrow, SiteIcon } from '@/design-system'
import { getContent } from '@/content'
import { ogImage } from '@/lib/seo'
import { IMG, altFor } from '@/lib/assets'
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
  const page = await getContent().pages.byPath('/culture')
  const shipped: Metadata = {
  title: 'Culture',
  description:
    'Tshechu, dzongs, textiles, Jomzo and the thirteen arts, Gross National Happiness, kira and gho, archery, and what is on the table. What you will see on a journey with us, and what it means.',
  alternates: { canonical: '/culture' },
  openGraph: { images: ogImage(IMG.tshechu) },
  }

  return {
    ...shipped,
    title: page?.seo.title ?? page?.title ?? shipped.title,
    description: page?.seo.description ?? page?.lead ?? shipped.description,
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function CulturePage() {

  /* The row behind this page: its SEO overrides and any JSON-LD the
     office added. Both are also read in `generateMetadata`, which Next
     runs separately — the provider's fetch is tagged and cached, so this
     is one request, not two. */
  const page = await getContent().pages.byPath('/culture')
  const settings = await getContent().settings.get()
  const articles = await getContent().culture.list()

  return (
    <main>
      {/* Structured data. Every page emits one `@graph`; this is where a
          page with no entity of its own still says what it is, where it
          sits in the trail, and who publishes it. `extra` is whatever the
          office added on the SEO tab. */}
      <JsonLd
        graph={await graphForIndex({
          path: '/culture',
          title: page?.seo.title ?? page?.title ?? 'Culture',
          description: page?.seo.description ?? page?.lead ?? settings.defaultSeo.description,
          crumbs: [{ name: 'Culture', path: '/culture' }],
          items: articles.map((a) => ({ path: a.path, name: a.title })),
          extra: page?.seo.schemaJson,
        })}
      />
      <Parallax
        src={IMG.tashichho}
        alt={altFor(IMG.tashichho)}
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
                    alt={a.imageAlt}
                    speed={0.5}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    style={{ aspectRatio: flipped ? '4/5' : '3/2', borderRadius: 'var(--radius-sm)' }}
                  />
                </Reveal>
                <div style={{ direction: 'ltr' }}>
                  <Reveal delay={240}>
                    <SiteIcon name={a.icon} size={40} color="var(--maroon)" />
                    <h2 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '14ch' }}>
                      <Link href={a.path} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {a.title}
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
                      {a.standfirst}
                    </p>
                  </Reveal>
                  <Reveal delay={640}>
                    <div style={{ marginTop: 'var(--space-6)' }}>
                      <Button href={a.path} variant="outline" size="sm">
                        About {a.title}
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
