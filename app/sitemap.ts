import type { MetadataRoute } from 'next'
import { getContent } from '@/content'

const BASE = process.env.SITE_URL ?? 'https://lotuspeak.org'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = getContent()
  const [tripSlugs, postSlugs] = await Promise.all([content.trips.slugs(), content.posts.slugs()])

  const pages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/trips`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/destinations`, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${BASE}/activities`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE}/journal`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/gallery`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/about`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE}/culture`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE}/contact`, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${BASE}/travellers-information`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  return [
    ...pages,
    ...tripSlugs.map((slug) => ({
      url: `${BASE}/trips/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...postSlugs.map((slug) => ({
      url: `${BASE}/journal/${slug}`,
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
  ]
}
