import { siteUrl } from '@/lib/env'
import { getContent } from '@/content'

/**
 * The journal, as RSS.
 *
 * Small and worth having: it is how somebody subscribes without an account,
 * and it is one of the few things a reader can take with them if this site
 * disappears.
 *
 * Hand-written XML rather than a library. It is forty lines, the escaping is
 * the only part that matters, and a dependency for it would be a dependency to
 * keep current for the life of the site.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const content = getContent()
  const [posts, settings] = await Promise.all([
    content.posts.list({ limit: 20 }),
    content.settings.get(),
  ])

  const base = siteUrl()

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escape(post.title)}</title>
      <link>${base}/journal/${post.slug}</link>
      <guid isPermaLink="true">${base}/journal/${post.slug}</guid>
      <description>${escape(post.standfirst)}</description>
      <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>
      <category>${escape(post.region)}</category>
    </item>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(settings.brand)} — Journal</title>
    <link>${base}/journal</link>
    <description>${escape(settings.defaultSeo.description)}</description>
    <language>en-GB</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

/**
 * The five XML entities.
 *
 * `&` first, or the ampersands introduced by the other four are escaped a
 * second time and the feed fills with `&amp;lt;`.
 */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
