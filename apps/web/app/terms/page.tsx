import { JsonLd } from '@/seo/JsonLd'
import { graphForPage } from '@/seo/graph'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getContent } from '@/content'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { InfoPage } from '@/sections/shared/InfoPage'

/**
 * The terms.
 *
 * Rendered from the `Page` row at `/terms`, which is where its fourteen
 * clauses live now. It keeps the `InfoPage` layout — a sticky contents column
 * and one measure of prose — because that layout is what makes a long
 * reference page navigable, and because the design has it and this page is
 * one of the two it was built for.
 *
 * The clauses that are still waiting on Lotus Peak — the deposit percentage,
 * the balance deadline, the cancellation scale — are now editable by the
 * office rather than by a developer, which is the whole point of the move.
 */
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/terms')
  return {
    title: page?.seo.title ?? page?.title ?? 'Terms & conditions',
    description: page?.seo.description ?? page?.lead ?? undefined,
    openGraph: { images: ogImage(IMG.dzong) },
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function TermsPage() {
  const page = await getContent().pages.byPath('/terms')
  if (!page) notFound()

  return (
    <>
      {/* Structured data. Every page emits one `@graph`; this is where a
          page with no entity of its own still says what it is, where it
          sits in the trail, and who publishes it. `extra` is whatever the
          office added on the SEO tab. */}
      <JsonLd
        graph={await graphForPage({
          path: '/terms',
          title: page.seo.title ?? page.title,
          description: page.seo.description ?? page.lead ?? '',
          crumbs: [{ name: 'Terms', path: '/terms' }],
          extra: page.seo.schemaJson,
        })}
      />
      <InfoPage
        eyebrow={page.eyebrow ?? 'Terms'}
        title={page.title}
        lead={page.lead ?? ''}
        bands={page.bands}
        note="Lotus Peak Tours & Travel · Thimphu, Bhutan · Last revised for the 2026 season."
      />
    </>
  )
}
