import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getContent } from '@/content'
import { entityMetadata } from '@/lib/seo'
import { DestinationArticle } from '@/sections/article/DestinationArticle'

/** Every published valley, prerendered. A place's page is one level down. */
export async function generateStaticParams() {
  const all = await getContent().destinations.list()
  return all.filter((d) => d.parentSlug === null).map((d) => ({ slug: d.slug }))
}

/** A valley, or nothing: a place's slug here is not its address. */
async function valley(slug: string) {
  const page = await getContent().destinations.bySlug(slug)
  return page && page.parentSlug === null ? page : null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await valley((await params).slug)
  if (!page) return { title: 'Not found' }
  return entityMetadata({
    path: page.path,
    title: page.name,
    description: page.standfirst || page.blurb,
    image: page.image,
    seo: page.seo,
  })
}

export default async function ValleyPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await valley((await params).slug)
  if (!page) notFound()
  return <DestinationArticle page={page} />
}
