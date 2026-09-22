import { journalCategoryLabel, type JournalCategory } from '@lotuspeak/api-contracts'
import { Eyebrow } from '@/design-system'
import { fmt, type Post } from '@/content/types'
import { Reveal } from '@/motion'
import { PageCard } from '@/sections/article/PageCard'
import { ShelfNav } from '@/sections/article/ShelfNav'

/**
 * The journal, whole or one shelf of it.
 *
 * The line above each title is the shelf and the date, and — where the entry
 * is about somewhere — the place, which is a page of its own under Where we
 * go. It used to be a free-text region, which is how the journal became a
 * list of places.
 */
export function JournalIndex({
  eyebrow,
  title,
  lead,
  current,
  posts,
  empty,
}: {
  eyebrow: string
  title: string
  lead: string | null
  current: JournalCategory | null
  posts: Post[]
  /** What an empty shelf says. */
  empty: string
}) {
  const [first, ...rest] = posts

  return (
    <>
      <Reveal>
        <Eyebrow number="Journal">{eyebrow}</Eyebrow>
        <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '20ch' }}>{title}</h1>
      </Reveal>

      {lead && (
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
            {lead}
          </p>
        </Reveal>
      )}

      <Reveal delay={300} style={{ marginTop: 'var(--space-8)' }}>
        <ShelfNav current={current} />
      </Reveal>

      {!first && (
        <p style={{ marginTop: 'var(--space-8)', color: 'var(--text-muted)', maxWidth: 'var(--measure-narrow)' }}>
          {empty}
        </p>
      )}

      {first && (
        <Reveal delay={400} y={40} style={{ marginTop: 'var(--space-9)' }}>
          <PageCard
            lead
            priority
            href={first.path}
            image={first.heroImage}
            alt={first.heroAlt}
            eyebrow={line(first)}
            title={first.title}
            text={first.standfirst}
          />
        </Reveal>
      )}

      {rest.length > 0 && (
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
              <PageCard
                href={post.path}
                image={post.heroImage}
                alt={post.heroAlt}
                eyebrow={line(post)}
                title={post.title}
                text={post.standfirst}
              />
            </Reveal>
          ))}
        </div>
      )}
    </>
  )
}

function line(post: Post): string {
  return [journalCategoryLabel(post.category), post.places[0]?.title, fmt.date(post.date)]
    .filter(Boolean)
    .join(' · ')
}
