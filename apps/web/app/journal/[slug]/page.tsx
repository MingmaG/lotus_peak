import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Divider, Eyebrow } from '@/design-system'
import { getContent } from '@/content'
import { fmt } from '@/content/types'
import { ogImage } from '@/lib/seo'
import { Parallax, Reveal } from '@/motion'
import { PostBody } from '@/sections/journal/PostBody'
import { heroOffset } from '@/sections/shared/Section'

export async function generateStaticParams() {
  const slugs = await getContent().posts.slugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getContent().posts.bySlug(slug)
  if (!post) return { title: 'Not found' }

  return {
    title: post.title,
    description: post.standfirst,
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.standfirst,
      publishedTime: post.date,
      images: ogImage(post.heroImage),
    },
  }
}

export default async function JournalEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const content = getContent()
  const post = await content.posts.bySlug(slug)
  if (!post) notFound()

  const more = await content.posts.list({ exclude: slug, limit: 3 })

  return (
    <main>
      <Parallax
        src={post.heroImage}
        alt={post.heroAlt}
        speed={0.6}
        priority
        style={{ height: '78svh', minHeight: 520, display: 'flex', alignItems: 'flex-end', ...heroOffset }}
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
            <Eyebrow tone="inverse">
              {post.region} · <time dateTime={post.date}>{fmt.date(post.date)}</time>
            </Eyebrow>
          </Reveal>
          <Reveal delay={240}>
            <h1 style={{ fontSize: 'var(--text-display)', lineHeight: 1, maxWidth: '14ch' }}>{post.title}</h1>
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
              {post.standfirst}
            </p>
          </Reveal>
        </div>
      </Parallax>

      <article style={{ padding: 'var(--space-9) var(--gutter) var(--space-10)' }}>
        <div style={{ maxWidth: 'var(--container-text)', margin: '0 auto' }}>
          <PostBody blocks={post.body} />
        </div>
      </article>

      {more.length > 0 && (
        <section style={{ padding: '0 var(--gutter) var(--space-10)' }}>
          <div style={{ maxWidth: 'var(--container)', margin: '0 auto' }}>
            <Divider variant="kera" />
            <div style={{ marginTop: 'var(--space-8)' }}>
              <Reveal>
                <Eyebrow>More from the journal</Eyebrow>
              </Reveal>
              <ul
                className="lp-three-col"
                style={{
                  listStyle: 'none',
                  margin: 'var(--space-7) 0 0',
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                  gap: 'var(--space-6)',
                }}
              >
                {more.map((other, i) => (
                  <Reveal key={other.slug} as="li" delay={i * 180}>
                    <Link
                      href={`/journal/${other.slug}`}
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        color: 'inherit',
                        borderTop: '1px solid var(--border-gold)',
                        paddingTop: 18,
                      }}
                    >
                      <Eyebrow tone="muted">{other.region}</Eyebrow>
                      <div style={{ marginTop: 12, fontSize: 'var(--text-h3)' }}>{other.title}</div>
                      <p style={{ marginTop: 10, color: 'var(--text-muted)', lineHeight: 'var(--leading-body)' }}>
                        {other.standfirst}
                      </p>
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
