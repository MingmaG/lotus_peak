import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Eyebrow } from '@/design-system'
import { getContent } from '@/content'
import { SearchFieldFallback, SearchView } from '@/sections/search/SearchView'
import { JsonLd } from '@/seo/JsonLd'
import { graphForPage } from '@/seo/graph'

/**
 * Site search.
 *
 * Prerendered like every other page: the shell and the browse links are
 * static HTML, and the results are drawn in the browser from
 * `/search-index.json` for whatever `?q=` says. Reading `searchParams` here
 * instead would make this the one route rendered on every request.
 *
 * Not in the sitemap and not indexed. A results page is a page about another
 * page, and search engines treat a site that offers them its own results as
 * thin content; `follow` still lets a crawler through the links.
 *
 * The heading and lead come from a `/search` Page row when the office makes
 * one, and fall back to these words when it has not.
 */
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/search')
  return {
    title: page?.seo.title ?? page?.title ?? 'Search',
    description: page?.seo.description ?? page?.lead ?? 'Search journeys, places, culture and the journal.',
    alternates: { canonical: '/search' },
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage() {
  const content = getContent()
  const [page, settings] = await Promise.all([content.pages.byPath('/search'), content.settings.get()])
  const title = page?.title ?? 'Search'
  const lead = page?.lead ?? 'Journeys, valleys and places, culture and the journal.'

  return (
    <main
      style={{
        position: 'relative',
        padding: 'var(--space-8) var(--gutter) var(--space-10)',
        maxWidth: 'var(--container-text)',
        margin: '0 auto',
      }}
    >
      <JsonLd
        graph={await graphForPage({
          path: '/search',
          title,
          description: page?.seo.description ?? lead,
          crumbs: [{ name: title, path: '/search' }],
          extra: page?.seo.schemaJson,
        })}
      />

      <Eyebrow>{page?.eyebrow ?? 'Find'}</Eyebrow>
      <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20 }}>{title}</h1>
      <p
        style={{
          marginTop: 16,
          marginBottom: 'var(--space-7)',
          fontSize: 'var(--text-lead)',
          lineHeight: 'var(--leading-lead)',
          color: 'var(--text-muted)',
          maxWidth: 'var(--measure-narrow)',
        }}
      >
        {lead}
      </p>

      {/* The fallback is the box without its results: in the static HTML,
          and working without scripts, rather than a gap where it will be. */}
      <Suspense fallback={<SearchFieldFallback />}>
        <SearchView />
      </Suspense>

      <noscript>
        <p style={{ marginTop: 'var(--space-6)', color: 'var(--text-muted)' }}>
          Search needs JavaScript. Everything it finds is also reachable from the pages below.
        </p>
      </noscript>

      {settings.nav.length > 0 && (
        <nav aria-label="Browse" style={{ marginTop: 'var(--space-9)', borderTop: 'var(--hairline)', paddingTop: 'var(--space-6)' }}>
          <Eyebrow tone="muted">Or browse</Eyebrow>
          <ul
            style={{
              listStyle: 'none',
              margin: 'var(--space-4) 0 0',
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px 28px',
            }}
          >
            {settings.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="lp-search-browse">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  )
}
