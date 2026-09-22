import { siteUrl } from '@/lib/env'
import type { MetadataRoute } from 'next'

/**
 * robots.txt.
 *
 * Two things beyond the obvious.
 *
 * `/api/` is disallowed because nothing under it is a page — the enquiry
 * endpoint and the revalidation hook are not content, and a crawler spending
 * its budget on them is a crawler not reading the journeys.
 *
 * The two `llms` files are *not* disallowed, and are named in a comment
 * instead. There is no standard directive for them yet; what matters is that
 * they are reachable, linked from the home page's `<head>`, and listed here
 * where somebody looking for them will look.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
