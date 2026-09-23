import { getContent } from '@/content'
import { fmt, type DestinationPage } from '@/content/types'
import { journalCategoryLabel } from '@lotuspeak/api-contracts'
import { Reveal } from '@/motion'
import { PostBody } from '@/sections/journal/PostBody'
import { JsonLd } from '@/seo/JsonLd'
import { graphForDestination } from '@/seo/graph'

import { ArticleHero } from './ArticleHero'
import { PageCard } from './PageCard'
import { CardGrid, JourneyList, RelatedBand } from './Related'

/**
 * A valley's page, or a place's.
 *
 * One template for both routes — `/destinations/paro` and
 * `/destinations/paro/taktsang` — because they are one kind of page at two
 * scales. What differs is only what there is to show: a valley has places,
 * and a place has a valley to go back to.
 *
 * Below the body, the other two sections meet this one: the culture seen
 * here, and what the journal has written about it. Each is a card linking to
 * its own page, never a paragraph copied in.
 */
export async function DestinationArticle({ page }: { page: DestinationPage }) {
  const trips = await getContent().trips.list()
  const bySlug = new Map(trips.map((t) => [t.slug, t]))
  const journeys = page.tripSlugs.map((slug) => bySlug.get(slug)).filter((t) => t !== undefined)
  const where = page.parent?.title ?? page.name

  return (
    <main>
      <JsonLd graph={await graphForDestination(page)} />

      <ArticleHero
        image={page.image}
        alt={page.imageAlt}
        trail={[
          { label: 'Where we go', href: '/destinations' },
          ...(page.parent ? [{ label: page.parent.title, href: page.parent.path }] : []),
          { label: page.name },
        ]}
        eyebrow={
          page.altitudeMetres
            ? `${page.blurb} · ${page.altitudeMetres.toLocaleString('en-GB')} m`
            : page.blurb
        }
        title={page.name}
        standfirst={page.standfirst}
      />

      {page.body && (
        <article style={{ padding: 'var(--space-9) var(--gutter) var(--space-10)' }}>
          <div style={{ maxWidth: 'var(--container-text)', margin: '0 auto' }}>
            <PostBody html={page.body} />
          </div>
        </article>
      )}

      {page.placeCards.length > 0 && (
        <RelatedBand title={`Places in ${page.name}`}>
          <CardGrid>
            {page.placeCards.map((place) => (
              <PageCard
                key={place.slug}
                href={place.path}
                image={place.image}
                alt={place.imageAlt}
                title={place.name}
                text={place.standfirst || place.blurb}
              />
            ))}
          </CardGrid>
        </RelatedBand>
      )}

      {page.culture.length > 0 && (
        <RelatedBand title="Culture you will see here">
          <CardGrid>
            {page.culture.map((article) => (
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

      {page.posts.length > 0 && (
        <RelatedBand title={`From the journal: ${page.name}`}>
          <CardGrid>
            {page.posts.map((post) => (
              <PageCard
                key={post.slug}
                href={post.path}
                image={post.heroImage}
                alt={post.heroAlt}
                eyebrow={`${journalCategoryLabel(post.category)} · ${fmt.date(post.date)}`}
                title={post.title}
                text={post.standfirst}
              />
            ))}
          </CardGrid>
        </RelatedBand>
      )}

      {journeys.length > 0 && (
        <RelatedBand title={page.parent ? `Journeys through ${where}` : 'Journeys that go there'}>
          <Reveal>
            <JourneyList trips={journeys} />
          </Reveal>
        </RelatedBand>
      )}
    </main>
  )
}
