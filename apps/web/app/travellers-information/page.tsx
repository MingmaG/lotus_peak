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
    <InfoPage
      eyebrow={page.eyebrow ?? 'Travellers'}
      title={page.title}
      lead={page.lead ?? ''}
      bands={page.bands}
      note="Last reviewed for the 2026 season. Ask us if you are reading this later than that."
    />
  )
}
