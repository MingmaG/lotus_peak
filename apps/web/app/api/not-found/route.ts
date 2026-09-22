import { NextResponse, type NextRequest } from 'next/server'

/**
 * Forwards a 404 to the admin panel.
 *
 * A thin proxy rather than the browser posting to the admin panel directly:
 * the admin panel is on another origin, so a direct call would need CORS on an
 * unauthenticated endpoint, and its address would be in the page source of
 * every 404. This keeps both on this site's own origin.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const base = process.env.CONTENT_API_URL
  if (!base) return new NextResponse(null, { status: 204 })

  const body = (await request.json().catch(() => null)) as
    | { path?: string; referrer?: string | null }
    | null

  if (!body?.path || !body.path.startsWith('/')) {
    return new NextResponse(null, { status: 204 })
  }

  void fetch(`${base.replace(/\/$/, '')}/api/public/not-found`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      /* Passed through so the admin panel can tell a browser from a scanner. */
      'user-agent': request.headers.get('user-agent') ?? '',
    },
    body: JSON.stringify({ path: body.path, referrer: body.referrer ?? null }),
  }).catch(() => undefined)

  return new NextResponse(null, { status: 204 })
}
