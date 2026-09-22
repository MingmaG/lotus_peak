import { createHmac, timingSafeEqual } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { REVALIDATE_TAGS, type RevalidateRequest } from '@lotuspeak/api-contracts'

/**
 * The admin panel telling this site something was published.
 *
 * Drops the named cache tags, so the pages that read them rebuild on their
 * next request. A few hundred milliseconds, and no deploy.
 *
 * ## Why it is signed, and why the timestamp is in the signature
 *
 * Dropping every cache tag is a cheap way to make this site rerender every
 * page on every request — a denial of service that costs the attacker one
 * POST. The HMAC is over the whole body, and the body carries `issuedAt`, so a
 * request captured from a log cannot be replayed tomorrow to do it again.
 *
 * Five minutes of skew is allowed. Long enough for two machines whose clocks
 * have drifted, short enough that a captured request is useless by the time
 * anybody reads the log it came from.
 */

const MAX_SKEW_MS = 5 * 60 * 1000

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    /* Not an error the caller can fix, and not something to be quiet about:
       publishing appears to work and never reaches the site. */
    console.error(
      '[revalidate] REVALIDATE_SECRET is not set, so publishes cannot reach this site.',
    )
    return NextResponse.json(
      { error: 'This site is not configured to accept revalidation.' },
      { status: 503 },
    )
  }

  const body = await request.text()
  const provided = request.headers.get('x-lotuspeak-signature') ?? ''
  const expected = createHmac('sha256', secret).update(body).digest('hex')

  /**
   * Constant-time, and length-checked first.
   *
   * `timingSafeEqual` throws on a length mismatch rather than returning false,
   * which would turn a short signature into a 500 instead of a 401.
   */
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 401 })
  }

  let payload: RevalidateRequest
  try {
    payload = JSON.parse(body) as RevalidateRequest
  } catch {
    return NextResponse.json({ error: 'Bad body.' }, { status: 400 })
  }

  const age = Math.abs(Date.now() - new Date(payload.issuedAt).getTime())
  if (!Number.isFinite(age) || age > MAX_SKEW_MS) {
    return NextResponse.json({ error: 'Stale request.' }, { status: 401 })
  }

  const known = new Set<string>(Object.values(REVALIDATE_TAGS))
  const tags = (payload.tags ?? []).filter((tag) => known.has(tag))
  for (const tag of tags) revalidateTag(tag)

  /**
   * Paths are revalidated as well as tags, and only ones on this origin.
   *
   * A tag covers every page that *read* that data; a path covers a page that
   * has to change for a reason the fetch cache cannot see — a slug that moved,
   * a page unpublished. Filtering to absolute paths stops the admin panel, or
   * anything that has got hold of the secret, naming something outside this
   * site.
   */
  const paths = (payload.paths ?? []).filter(
    (path) => path.startsWith('/') && !path.startsWith('//'),
  )
  for (const path of paths) revalidatePath(path)

  return NextResponse.json({ revalidated: { tags, paths }, at: new Date().toISOString() })
}
