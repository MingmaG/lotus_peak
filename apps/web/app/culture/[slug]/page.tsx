import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getContent } from '@/content'
import { entityMetadata } from '@/lib/seo'
import { CultureArticleView } from '@/sections/article/CultureArticleView'

export async function generateStaticParams() {
  return (await getContent().culture.list()).map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getContent().culture.bySlug((await params).slug)
  if (!page) return { title: 'Not found' }
  return entityMetadata({
    path: page.path,
    title: page.title,
    description: page.standfirst,
    image: page.image,
    seo: page.seo,
    type: 'article',
  })
}

export default async function CulturePiecePage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await getContent().culture.bySlug((await params).slug)
  if (!page) notFound()
  return <CultureArticleView page={page} />
}
