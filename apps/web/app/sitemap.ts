import type { MetadataRoute } from 'next'
import { getContent } from '@/content'

/**
 * The sitemap, from published rows.
 *
 * It used to be a literal list of eleven routes plus two slug maps, which was
 * correct on the day it was written and wrong the first time a page was added
 * or unpublished. Every entry now carries the row's own `lastModified`,
 * priority and change frequency — which is what makes `<lastmod>` mean
 * something instead of being today's date on forty URLs.
 *
 * A page marked `noindex` is not here. A sitemap entry for a page that asks
 * not to be indexed is a contradiction a crawler reports.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lotuspeak.org').replace(/\/$/, '')
  const entries = await getContent().discovery.sitemap()

  return entries.map((entry) => ({
    url: `${base}${entry.path === '/' ? '' : entry.path}`,
    lastModified: new Date(entry.lastModified),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))
}
