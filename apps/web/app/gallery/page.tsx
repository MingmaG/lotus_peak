import type { Metadata } from 'next'
import Image from 'next/image'
import { Eyebrow } from '@/design-system'
import { getContent } from '@/content'
import { IMG, altFor } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { Reveal } from '@/motion'

/**
 * The title and description come from this route's `Page` row.
 *
 * `generateMetadata` rather than a constant, because a constant cannot read
 * the database — which is how the contact page ended up publishing a
 * telephone number the office had already changed. What the row does not
 * override falls back to what this page shipped with.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/gallery')
  const shipped: Metadata = {
  title: 'Gallery',
  description:
    'Photographs from our journeys: tshechu in the dzong courtyards, the valleys, the monasteries, and the ordinary afternoons in between.',
  openGraph: { images: ogImage(IMG.chamMaskedDance) },
  }

  return {
    ...shipped,
    title: page?.seo.title ?? page?.title ?? shipped.title,
    description: page?.seo.description ?? page?.lead ?? shipped.description,
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function GalleryPage() {
  const images = await getContent().gallery.list()

  return (
    <main
      style={{
        position: 'relative',
        padding: 'var(--space-8) var(--gutter) var(--space-10)',
        maxWidth: 'var(--container)',
        margin: '0 auto',
      }}
    >
      <Reveal>
        <Eyebrow number="Gallery">Photographs</Eyebrow>
        <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '20ch' }}>
          What the days actually look like
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
          Taken on our own journeys. Nothing here is a stock photograph of somewhere else.
        </p>
      </Reveal>

      {/* Columns rather than a grid: the photographs keep their own proportions
          and the column count is the only thing that changes with width. */}
      <div className="lp-gallery" style={{ marginTop: 'var(--space-9)' }}>
        {images.map((image, i) => (
          <Reveal
            key={image.src}
            delay={(i % 3) * 160}
            y={32}
            style={{ breakInside: 'avoid', marginBottom: 'var(--space-6)' }}
          >
            <figure style={{ margin: 0 }}>
              <div
                style={{
                  position: 'relative',
                  aspectRatio: image.ratio,
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={image.src}
                  alt={image.alt ?? altFor(image.src)}
                  fill
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  style={{ objectFit: 'cover' }}
                  priority={i < 3}
                />
              </div>
              <figcaption
                style={{
                  marginTop: 10,
                  fontSize: 'var(--text-small)',
                  color: 'var(--text-muted)',
                }}
              >
                {image.caption}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </main>
  )
}
