import type { MetadataRoute } from 'next'
import { getContent } from '@/content'

const BASE = process.env.SITE_URL ?? 'https://lotuspeak.org'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getContent().trips.slugs()

  const pages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/trips`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/about`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE}/culture`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE}/contact`, changeFrequency: 'yearly', priority: 0.7 },
  ]

  return [
    ...pages,
    ...slugs.map((slug) => ({
      url: `${BASE}/trips/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]
}
