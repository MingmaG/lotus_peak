import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Eyebrow } from '@/design-system'
import { getContent } from '@/content'
import { fmt, type Post } from '@/content/types'
import { altFor, media } from '@/lib/assets'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { Reveal } from '@/motion'

export const metadata: Metadata = {
  title: 'Journal',
  description:
    'Notes on the places our journeys go: Taktsang, Thimphu, Punakha Dzong, Bumthang and Trongsa. What is there, what it is for, and what it costs to go in.',
  openGraph: { images: ogImage(IMG.thimphuDzong) },
}

export default async function JournalPage() {
  const posts = await getContent().posts.list()
  const [lead, ...rest] = posts

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
        <Eyebrow number="Journal">Notes from Bhutan</Eyebrow>
        <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '20ch' }}>
          The places the journeys go
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
          What is at each place, what it is for, and the practical things — opening hours, entry fees, how
          long the walk takes. Fees are set nationally and change; each entry is dated.
        </p>
      </Reveal>

      {lead && (
        <Reveal delay={400} y={40} style={{ marginTop: 'var(--space-9)' }}>
          <Entry post={lead} lead />
        </Reveal>
      )}

      <div
        className="lp-trip-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
          gap: 'var(--space-8) var(--space-6)',
          marginTop: 'var(--space-9)',
        }}
      >
        {rest.map((post, i) => (
          <Reveal key={post.slug} delay={i * 180} y={40}>
            <Entry post={post} />
          </Reveal>
        ))}
      </div>
    </main>
  )
}

function Entry({ post, lead = false }: { post: Post; lead?: boolean }) {
  const asset = media(post.heroImage)

  return (
    <Link
      href={`/journal/${post.slug}`}
      className={lead ? 'lp-two-col' : undefined}
      style={{
        display: lead ? 'grid' : 'block',
        gridTemplateColumns: lead ? '1.1fr 1fr' : undefined,
        gap: lead ? 'var(--space-8)' : undefined,
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: lead ? '16/10' : '3/2',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
        }}
      >
        <Image
          src={post.heroImage}
          alt={post.heroAlt ?? altFor(post.heroImage)}
          fill
          sizes={lead ? '(max-width: 900px) 100vw, 55vw' : '(max-width: 900px) 100vw, 45vw'}
          style={{ objectFit: 'cover' }}
          priority={lead}
          {...(asset ? {} : { 'aria-hidden': true })}
        />
      </div>

      <div style={{ marginTop: lead ? 0 : 24 }}>
        <Eyebrow tone="muted">
          {post.region} · {fmt.date(post.date)}
        </Eyebrow>
        <h2
          style={{
            fontSize: lead ? 'var(--text-h2)' : 'var(--text-h3)',
            marginTop: 16,
            maxWidth: '18ch',
          }}
        >
          {post.title}
        </h2>
        <p
          style={{
            marginTop: 14,
            color: 'var(--text-muted)',
            maxWidth: 'var(--measure-narrow)',
            lineHeight: 'var(--leading-body)',
          }}
        >
          {post.standfirst}
        </p>
      </div>
    </Link>
  )
}
