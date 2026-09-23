import { NextResponse } from 'next/server'
import { EnquiryRefused, getContent } from '@/content'

export const runtime = 'nodejs'

/**
 * Enquiry intake — the only thing this website writes.
 *
 * It validates, then hands the record to the active content provider, which
 * posts it to the admin panel's public endpoint. Both ends validate: this one
 * so an obvious mistake is answered immediately and in the traveller's own
 * words, the admin one because it is reachable without going through here.
 *
 * The in-memory rate limit is per instance and deliberately kept even though
 * the admin panel has a real one backed by a table. It costs a Map lookup and
 * it stops a flood before it becomes an HTTP request to another service.
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

  /** A party size, or nothing. An unreadable one is dropped, not guessed at. */
  const count = (v: unknown) => {
    const n = Number.parseInt(String(v ?? '').trim(), 10)
    return Number.isFinite(n) && n >= 0 && n <= 60 ? n : undefined
  }

  const enquiry = {
    name,
    email,
    country: str(body.country, 80),
    phone: str(body.phone, 40),
    tripSlug: str(body.tripSlug, 60),
    travellers: str(body.travellers, 40),
    /* Counts go over the wire as numbers. The form sends the contents of a
       text input, so `"3"` has to become `3` here — sending the string is how
       this route spent a while answering every enquiry with a 500. */
    adults: count(body.adults),
    children: count(body.children),
    preferredDates: str(body.preferredDates, 120),
    message: str(body.message, 4000),
    restDays: body.restDays === 'on' || body.restDays === true,
    source: (['contact', 'trip-detail', 'drawer'] as const).includes(body.source as never)
      ? (body.source as 'contact' | 'trip-detail' | 'drawer')
      : ('contact' as const),
  }

  /**
   * A failure here is answered honestly.
   *
   * It used to throw, which Next turned into a bare 500 — and the form, which
   * announced "Sent" whatever came back, told the traveller their enquiry was
   * on its way while nothing had been written. An enquiry is the only thing
   * this site is for; losing one silently is the worst thing it can do.
   */
  try {
    const { id } = await getContent().enquiries.create(enquiry)
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    /* A refusal is repeated in its own words — it was written for the person
       reading it, and "several enquiries in a short time" is more use than
       being told to send an email instead. */
    if (error instanceof EnquiryRefused && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }

    console.error('[enquiries] the enquiry could not be recorded', error)
    return NextResponse.json(
      {
        ok: false,
        /* No address here: the form that sent this knows the company's, from
           the settings, and replaces this message with one that has it. */
        error: 'We could not record that just now.',
      },
      { status: 502 },
    )
  }
}
