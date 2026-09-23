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
 *
 * No `dynamicParams = false`, although the four keys are fixed. With it, the
 * first on-demand revalidation after a publish made Next regenerate the page
 * through a path that throws `NoFallbackError`, and all four shelves answered
 * 404 until the next deploy. An unknown key is refused by `shelf()` below with
 * `notFound()`, which is the same answer without the trap.
 */

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
    title: `Journal: ${category.label}`,
    description: category.description,
    alternates: { canonical: path },
    robots: { index: posts.length > 0, follow: true },
    openGraph: { title: `Journal: ${category.label}`, description: category.description, url: path },
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
          title: `Journal: ${category.label}`,
          description: category.description,
          crumbs: [
            { name: 'Journal', path: '/journal' },
            { name: category.label, path },
          ],
          items: posts.map((post) => ({ path: post.path, name: post.title })),
        })}
      />
      <JournalIndex
        eyebrow="Notes from Bhutan"
        title={category.label}
        lead={category.description}
        current={category.key}
        posts={posts}
        empty="Nothing on this shelf yet."
      />
    </main>
  )
}
