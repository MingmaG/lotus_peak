import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JOURNAL_CATEGORIES } from '@lotuspeak/api-contracts'
import { getContent } from '@/content'
import { JournalIndex } from '@/sections/journal/JournalIndex'
import { JsonLd } from '@/seo/JsonLd'
import { graphForIndex } from '@/seo/graph'

/**
 * One shelf of the journal: Journeys, Travel guides, Experiences, Stories.
 *
 * All four are prerendered whatever is on them, so a shelf gaining its first
 * entry needs no rebuild. An empty one says so, and asks not to be indexed —
 * a thin page is worse for the site than no page — and it is left out of the
 * sitemap by the panel for the same reason.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return JOURNAL_CATEGORIES.map((c) => ({ category: c.key }))
}

function shelf(key: string) {
  return JOURNAL_CATEGORIES.find((c) => c.key === key) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const category = shelf((await params).category)
  if (!category) return { title: 'Not found' }
  const posts = await getContent().posts.list({ category: category.key, limit: 1 })
  const path = `/journal/category/${category.key}`
  return {
    title: `${category.label} — Journal`,
    description: category.description,
    alternates: { canonical: path },
    robots: { index: posts.length > 0, follow: true },
    openGraph: { title: `${category.label} — Journal`, description: category.description, url: path },
  }
}

export default async function JournalShelfPage({ params }: { params: Promise<{ category: string }> }) {
  const category = shelf((await params).category)
  if (!category) notFound()

  const posts = await getContent().posts.list({ category: category.key })
  const path = `/journal/category/${category.key}`

  return (
    <main
      style={{
        position: 'relative',
        padding: 'var(--space-8) var(--gutter) var(--space-10)',
        maxWidth: 'var(--container)',
        margin: '0 auto',
      }}
    >
      <JsonLd
        graph={await graphForIndex({
          path,
          title: `${category.label} — Journal`,
          description: category.description,
          crumbs: [
            { name: 'Journal', path: '/journal' },
            { name: category.label, path },
          ],
          items: posts.map((post) => ({ path: post.path, name: post.title })),
        })}
      />
      <JournalIndex
        eyebrow="Journal"
        title={category.label}
        lead={category.description}
        current={category.key}
        posts={posts}
        empty="Nothing on this shelf yet."
      />
    </main>
  )
}
