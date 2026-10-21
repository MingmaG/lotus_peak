import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { journalCategoryLabel } from '@lotuspeak/api-contracts'
import { getContent } from '@/content'
import { fmt } from '@/content/types'
import { entityMetadata } from '@/lib/seo'
import { Reveal } from '@/motion'
import { ArticleHero } from '@/sections/article/ArticleHero'
import { PageCard } from '@/sections/article/PageCard'
import { CardGrid, JourneyList, RelatedBand } from '@/sections/article/Related'
import { PostBody } from '@/sections/journal/PostBody'
import { JsonLd } from '@/seo/JsonLd'
import { graphForPost } from '@/seo/graph'

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

  return entityMetadata({
    path: post.path,
    title: post.title,
    description: post.standfirst,
    image: post.heroImage,
    seo: post.seo,
    type: 'article',
    publishedTime: post.date,
  })
}

export default async function JournalEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const content = getContent()
  const post = await content.posts.bySlug(slug)
  if (!post) notFound()

  const [more, trips] = await Promise.all([
    content.posts.list({ exclude: slug, limit: 3 }),
    post.relatedTripSlugs.length ? content.trips.list() : Promise.resolve([]),
  ])
  const journeys = post.relatedTripSlugs
    .map((s) => trips.find((t) => t.slug === s))
    .filter((t) => t !== undefined)
  const shelf = journalCategoryLabel(post.category)

  return (
    <main>
      <JsonLd graph={await graphForPost(post)} />

      <ArticleHero
        image={post.heroImage}
        alt={post.heroAlt}
        trail={[
          { label: 'Journal', href: '/journal' },
          { label: shelf, href: `/journal/category/${post.category}` },
          { label: post.title },
        ]}
        eyebrow={
          <>
            {shelf} · <time dateTime={post.date}>{fmt.date(post.date)}</time>
          </>
        }
        title={post.title}
        standfirst={post.standfirst}
      />

      <article style={{ padding: 'var(--space-9) var(--gutter) var(--space-10)' }}>
        <div style={{ maxWidth: 'var(--container-text)', margin: '0 auto' }}>
          <PostBody html={post.body} />
        </div>
      </article>

      {post.destinations.length > 0 && (
        <RelatedBand title="The places in this entry">
          <CardGrid>
            {post.destinations.map((place) => (
              <PageCard
                key={place.slug}
                href={place.path}
                image={place.image}
                alt={place.imageAlt}
                eyebrow="Where we go"
                title={place.name}
                text={place.standfirst || place.blurb}
              />
            ))}
          </CardGrid>
        </RelatedBand>
      )}

      {post.culture.length > 0 && (
        <RelatedBand title="The culture behind it">
          <CardGrid>
            {post.culture.map((article) => (
              <PageCard
                key={article.slug}
                href={article.path}
                image={article.image}
                alt={article.imageAlt}
                eyebrow="Culture"
                title={article.title}
                text={article.standfirst}
              />
            ))}
          </CardGrid>
        </RelatedBand>
      )}

      {journeys.length > 0 && (
        <RelatedBand title="Journeys that go there">
          <Reveal>
            <JourneyList trips={journeys} />
          </Reveal>
        </RelatedBand>
      )}

      {more.length > 0 && (
        <RelatedBand title="More from the journal">
          <CardGrid>
            {more.map((other) => (
              <PageCard
                key={other.slug}
                href={other.path}
                image={other.heroImage}
                alt={other.heroAlt}
                eyebrow={journalCategoryLabel(other.category)}
                title={other.title}
                text={other.standfirst}
              />
            ))}
          </CardGrid>
        </RelatedBand>
      )}
    </main>
  )
}
