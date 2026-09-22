import { getContent } from '@/content'

/**
 * Every journey and every journal entry, as markdown, in one file.
 *
 * So a model that followed `llms.txt` can have the whole publication in one
 * more request rather than forty. Facts are in tables rather than sentences:
 * a model asked how high the Jomolhari trek goes can lift 4,930 from a row,
 * and has to parse prose to get it from "a pass at 4,930 m".
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const text = await getContent().discovery.llmsFullTxt()

  return new Response(text, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
