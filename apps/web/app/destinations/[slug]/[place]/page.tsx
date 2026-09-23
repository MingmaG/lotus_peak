import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getContent } from '@/content'
import { entityMetadata } from '@/lib/seo'
import { DestinationArticle } from '@/sections/article/DestinationArticle'

/** Every published place, under its own valley. */
export async function generateStaticParams() {
  const all = await getContent().destinations.list()
  return all
    .filter((d) => d.parentSlug !== null)
    .map((d) => ({ slug: d.parentSlug as string, place: d.slug }))
}

/**
 * The place, if the valley in the URL is the one it is in.
 *
 * `/destinations/thimphu/taktsang` must not render Taktsang: that is a second
 * address for one page, which is a duplicate to a crawler and a wrong
 * breadcrumb to a reader. A place that moves valleys gets a redirect from the
 * panel instead.
 */
async function place(slug: string, placeSlug: string) {
  const page = await getContent().destinations.bySlug(placeSlug)
  return page && page.parentSlug === slug ? page : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; place: string }>
}): Promise<Metadata> {
  const { slug, place: placeSlug } = await params
  const page = await place(slug, placeSlug)
  if (!page) return { title: 'Not found' }
  return entityMetadata({
    path: page.path,
    title: page.parent ? `${page.name}, ${page.parent.title}` : page.name,
    description: page.standfirst || page.blurb,
    image: page.image,
    seo: page.seo,
  })
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string; place: string }> }) {
  const { slug, place: placeSlug } = await params
  const page = await place(slug, placeSlug)
  if (!page) notFound()
  return <DestinationArticle page={page} />
}
