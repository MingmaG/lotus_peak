import { JsonLd } from '@/seo/JsonLd'
import { graphForPage } from '@/seo/graph'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getContent } from '@/content'
import { IMG } from '@/lib/assets'
import { ogImage } from '@/lib/seo'
import { InfoPage } from '@/sections/shared/InfoPage'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const page = await getContent().pages.byPath('/travellers-information')
  return {
    title: page?.seo.title ?? page?.title ?? 'Travellers’ information',
    description: page?.seo.description ?? page?.lead ?? undefined,
    openGraph: { images: ogImage(IMG.thimphuValley) },
    robots: { index: !page?.seo.noIndex, follow: true },
  }
}

export default async function TravellersInformationPage() {
  const page = await getContent().pages.byPath('/travellers-information')
  if (!page) notFound()

  return (
    <>
      {/* Structured data. Every page emits one `@graph`; this is where a
          page with no entity of its own still says what it is, where it
          sits in the trail, and who publishes it. `extra` is whatever the
          office added on the SEO tab. */}
      <JsonLd
        graph={await graphForPage({
          path: '/travellers-information',
          title: page.seo.title ?? page.title,
          description: page.seo.description ?? page.lead ?? '',
          crumbs: [{ name: "Travellers’ information", path: '/travellers-information' }],
          extra: page.seo.schemaJson,
        })}
      />
      <InfoPage
        eyebrow={page.eyebrow ?? 'Travellers'}
        title={page.title}
        lead={page.lead ?? ''}
        bands={page.bands}
        note={page.note ?? undefined}
      />
    </>
  )
}
