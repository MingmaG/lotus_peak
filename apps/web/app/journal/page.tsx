import type { Metadata } from 'next'
import { getContent } from '@/content'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { JournalIndex } from '@/sections/journal/JournalIndex'
import { JsonLd } from '@/seo/JsonLd'
import { graphForIndex } from '@/seo/graph'

/**
 * The title and description come from this route's `Page` row, as do the
 * heading and the lead: the journal's own words are the office's to change.
 * What the row does not say falls back to what this page shipped with.
 */
export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/journal')
  return {
    title: page?.seo.title ?? page?.title ?? 'Journal',
    description:
      page?.seo.description ??
      page?.lead ??
      'Journeys, travel guides, experiences and stories from Bhutan.',
    alternates: { canonical: '/journal' },
    openGraph: { images: ogImage(IMG.thimphuDzong) },
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function JournalPage() {
  const content = getContent()
  const [page, settings, posts] = await Promise.all([
    content.pages.byPath('/journal'),
    content.settings.get(),
    content.posts.list(),
  ])

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
          path: '/journal',
          title: page?.seo.title ?? page?.title ?? 'Journal',
          description: page?.seo.description ?? page?.lead ?? settings.defaultSeo.description,
          crumbs: [{ name: 'Journal', path: '/journal' }],
          items: posts.map((post) => ({ path: post.path, name: post.title })),
          extra: page?.seo.schemaJson,
        })}
      />
      <JournalIndex
        eyebrow={page?.eyebrow ?? 'Notes from Bhutan'}
        title={page?.title ?? 'Journal'}
        lead={page?.lead ?? null}
        current={null}
        posts={posts}
        empty="Nothing in the journal yet."
      />
    </main>
  )
}
