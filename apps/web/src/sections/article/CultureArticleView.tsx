import { journalCategoryLabel } from '@lotuspeak/api-contracts'
import { fmt, type CulturePage } from '@/content/types'
import { PostBody } from '@/sections/journal/PostBody'
import { JsonLd } from '@/seo/JsonLd'
import { graphForCulture } from '@/seo/graph'

import { ArticleHero } from './ArticleHero'
import { PageCard } from './PageCard'
import { CardGrid, RelatedBand } from './Related'

/**
 * A culture piece's page: what it is and what it means, then where to see it
 * — the places, each a link to its own page — and what the journal has
 * written about it.
 */
export async function CultureArticleView({ page }: { page: CulturePage }) {
  return (
    <main>
      <JsonLd graph={await graphForCulture(page)} />

      <ArticleHero
        image={page.image}
        alt={page.imageAlt}
        trail={[{ label: 'Culture', href: '/culture' }, { label: page.title }]}
        eyebrow="Culture · Bhutanese traditions"
        title={page.title}
        standfirst={page.standfirst}
      />

      {page.body && (
        <article style={{ padding: 'var(--space-9) var(--gutter) var(--space-10)' }}>
          <div style={{ maxWidth: 'var(--container-text)', margin: '0 auto' }}>
            <PostBody html={page.body} />
          </div>
        </article>
      )}

      {page.destinations.length > 0 && (
        <RelatedBand title="Where to see it">
          <CardGrid>
            {page.destinations.map((place) => (
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

      {page.posts.length > 0 && (
        <RelatedBand title="From the journal">
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
    </main>
  )
}
