import { journalCategoryLabel } from '@lotuspeak/api-contracts'
import { TrekCard } from '@/design-system'
import { fmt, type Trip } from '@/content/types'
import { Reveal } from '@/motion'
import { PageCard } from '@/sections/article/PageCard'
import { CardGrid, RelatedBand } from '@/sections/article/Related'

/**
 * The foot of a journey's page: where it goes, what is seen on the way, what
 * has been written about it, and what else to consider.
 *
 * The same bands, cards and order as the foot of a place's page, so the four
 * sections still read as one site. Which bands draw is the office's choice —
 * `trip.sections` — and a band with nothing in it is not drawn whatever that
 * says; what fills each one when the office chose nothing is decided in the
 * admin panel, where the joins are, not here.
 */
export function TripRelated({ trip }: { trip: Trip }) {
  const { sections } = trip

  return (
    <>
      {sections.destinations && trip.destinations.length > 0 && (
        <RelatedBand title="Where you will go">
          <CardGrid>
            {trip.destinations.map((place) => (
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

      {sections.culture && trip.culture.length > 0 && (
        <RelatedBand title="Culture on the way">
          <CardGrid>
            {trip.culture.map((article) => (
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

      {sections.journal && trip.posts.length > 0 && (
        <RelatedBand title="From the journal">
          <CardGrid>
            {trip.posts.map((post) => (
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

      {sections.related && trip.related.length > 0 && (
        <RelatedBand title="Other journeys">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: 'var(--space-7)',
              marginTop: 'var(--space-7)',
            }}
          >
            {trip.related.map((other, i) => (
              <Reveal key={other.slug} delay={i * 200} y={40}>
                <TrekCard
                  href={`/trips/${other.slug}`}
                  image={other.heroImage}
                  imageAlt={other.heroAlt}
                  region={fmt.regionsShort(other)}
                  title={other.title}
                  days={fmt.duration(other)}
                  altitude={fmt.altitude(other)}
                  difficulty={other.difficulty}
                  price={fmt.price(other)}
                  sizes="(max-width: 900px) 100vw, 30vw"
                />
              </Reveal>
            ))}
          </div>
        </RelatedBand>
      )}
    </>
  )
}
