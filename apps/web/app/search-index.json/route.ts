import { buildSearchIndex } from '@/lib/search-index'

/**
 * Everything `/search` can find, as one static file.
 *
 * Built at build time and on the same revalidation as the pages it indexes,
 * so the search page stays prerendered and asks nothing of a server when a
 * traveller types: the ranking runs in the browser over this file. A few dozen
 * documents is well within what that can do on a phone.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const docs = await buildSearchIndex()

  return Response.json(docs, {
    headers: {
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  })
}
