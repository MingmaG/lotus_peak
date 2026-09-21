import { NextResponse } from 'next/server'
import { getContent } from '@/content'

export const runtime = 'nodejs'

/**
 * Enquiry intake. There is no backend yet, so this validates and hands the
 * record to the active content provider, which logs it. The mail adapter and
 * real rate limiting arrive with phase 5 (docs/specs/08-forms-and-enquiries.md).
 */
const hits = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60 * 60 * 1000
const LIMIT = 5

function rateLimited(ip: string) {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > LIMIT
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many enquiries. Please call us instead.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request.' }, { status: 400 })
  }

  // Honeypot: a real person never fills this in.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ ok: false, error: 'Please give us a name.' }, { status: 422 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'Please check the email address.' }, { status: 422 })
  }

  const str = (v: unknown, max: number) => {
    const s = String(v ?? '').trim()
    return s ? s.slice(0, max) : undefined
  }

  const { id } = await getContent().enquiries.create({
    name,
    email,
    country: str(body.country, 80),
    phone: str(body.phone, 40),
    tripSlug: str(body.tripSlug, 60),
    travellers: str(body.travellers, 40),
    adults: str(body.adults, 10),
    children: str(body.children, 10),
    preferredDates: str(body.preferredDates, 120),
    message: str(body.message, 4000),
    restDays: body.restDays === 'on' || body.restDays === true,
    source: (['contact', 'trip-detail', 'drawer'] as const).includes(body.source as never)
      ? (body.source as 'contact' | 'trip-detail' | 'drawer')
      : 'contact',
  })

  return NextResponse.json({ ok: true, id })
}
