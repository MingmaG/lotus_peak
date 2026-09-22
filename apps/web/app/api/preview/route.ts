import { jwtVerify } from 'jose'
import { cookies, draftMode } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Turns on draft mode and shows the page.
 *
 * The preview *is* this website — the real components, the real motion, the
 * real breakpoints — rendered from unpublished rows. A preview drawn a second
 * time inside the admin panel would be a picture of a website nobody has, and
 * it would drift the first time the design changed.
 *
 * What this does:
 *
 * 1. Verifies the fifteen-minute token the admin panel signed, and checks the
 *    path in it against the path being asked for. Without that check a token
 *    for one draft would be a token for every draft on the site.
 * 2. Turns on `draftMode`, which makes every page render on demand instead of
 *    being served from the prerendered cache.
 * 3. Keeps the token in a cookie, so the content provider can present it to
 *    the admin panel's API on the reads the page is about to make.
 */

export const dynamic = 'force-dynamic'

/**
 * The cookie name.
 *
 * A local constant rather than an export: a route file may only export
 * handlers and a fixed set of config keys, and exporting anything else fails
 * the build with a message about an index signature. The one other place that
 * needs the name — `src/content/api/client.ts` — has it written out, with this
 * comment as the reason.
 */
const PREVIEW_COOKIE = 'lp_preview_token'

export async function GET(request: NextRequest) {
  const secret = process.env.PREVIEW_SECRET
  if (!secret) {
    return new NextResponse(
      'PREVIEW_SECRET is not set on this site, so previews cannot be opened.',
      { status: 503 },
    )
  }

  const token = request.nextUrl.searchParams.get('token')
  const path = request.nextUrl.searchParams.get('path')

  if (!token || !path || !path.startsWith('/') || path.startsWith('//')) {
    return new NextResponse('That preview link is not valid.', { status: 400 })
  }

  let claimedPath: string
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: 'lotuspeak-admin',
      audience: 'preview',
    })
    claimedPath = String(payload.path ?? '')
  } catch {
    return new NextResponse(
      'That preview link has expired. Open it again from the admin panel.',
      { status: 401 },
    )
  }

  if (claimedPath !== path) {
    return new NextResponse('That preview link is for a different page.', { status: 403 })
  }

  const draft = await draftMode()
  draft.enable()

  const store = await cookies()
  store.set(PREVIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    /* Fifteen minutes, matching the token. A cookie that outlives its token
       is a page that renders as published while claiming to be a preview. */
    maxAge: 15 * 60,
  })

  return NextResponse.redirect(new URL(path, request.nextUrl.origin))
}

/** Leaves preview and goes back to the published site. */
export async function DELETE() {
  const draft = await draftMode()
  draft.disable()
  const store = await cookies()
  store.delete(PREVIEW_COOKIE)
  return new NextResponse(null, { status: 204 })
}
