import { NextResponse, after } from 'next/server'

import { EnquiryRefused, getContent } from '@/content'
import type { EnquiryReceipt } from '@/content/repository'
import { enquiryErrors } from '@/lib/enquiry-rules'
import { deliverEnquiryMail } from '@/lib/mail/enquiry'

export const runtime = 'nodejs'

/**
 * Enquiry intake — the only thing this website writes, and the only thing it
 * sends.
 *
 * It validates, hands the record to the active content provider, which posts
 * it to the admin panel's public endpoint, and then writes and sends the two
 * emails itself. Both ends validate: this one so an obvious mistake is
 * answered immediately and in the traveller's own words, the admin one because
 * it is reachable without going through here.
 *
 * ## Why the mail is sent from here
 *
 * It was sent by the panel, from inside the request that wrote the row, which
 * meant a panel that was down, restarting or mid-deploy took the office's
 * notification down with it — and a traveller who writes in during one of
 * those is a traveller nobody in the office ever hears about. The record still
 * belongs to the panel and is still tried first, because that is what puts its
 * rate limit and its reference number in front of the provider rather than
 * behind it. What changed is that failing to record no longer means failing to
 * tell anybody.
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

  /**
   * Whether the panel wants a Turnstile token, from the cached site settings.
   *
   * The token itself is not checked here. It is good for one verification,
   * and that one belongs to the panel, which is reachable without this route;
   * this only refuses an enquiry that arrives with no token at all, which is
   * also the only guard the mail below has when the panel cannot be reached.
   * Settings that cannot be read mean no such refusal — a missing check must
   * not become a missing enquiry.
   */
  const captcha = await getContent()
    .settings.get()
    .then((settings) => settings.captchaSiteKey !== null)
    .catch(() => false)

  /* The forms run the same rules first, so a traveller should only ever see
     one of these from a form that was bypassed. */
  const problems = Object.values(enquiryErrors(body, { captcha }))
  if (problems.length > 0) {
    return NextResponse.json({ ok: false, error: problems[0] }, { status: 422 })
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()

  const str = (v: unknown, max: number) => {
    const s = String(v ?? '').trim()
    return s ? s.slice(0, max) : undefined
  }

  /** A party size, or nothing. The range was checked above. */
  const count = (v: unknown) => {
    const n = Number.parseInt(String(v ?? '').trim(), 10)
    return Number.isFinite(n) ? n : undefined
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
    captchaToken: str(body.captchaToken, 4096),
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
  let receipt: EnquiryReceipt | null = null

  try {
    receipt = await getContent().enquiries.create(enquiry)
  } catch (error) {
    /* A refusal is repeated in its own words — it was written for the person
       reading it, and "several enquiries in a short time" is more use than
       being told to send an email instead.

       Nothing is sent after one, deliberately: a 4xx is the panel's rate limit
       or its honeypot saying no, and a mail sent past it would hand anybody
       who found this route the office's inbox and the day's allowance. */
    if (error instanceof EnquiryRefused && error.status >= 400 && error.status < 500) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    }

    /* Everything else — the panel is down, restarting, or not answering in
       ten seconds — falls through to the mail below, which is the whole point
       of sending it from here. */
    console.error('[enquiries] the enquiry could not be recorded', error)
  }

  const forMail = {
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    country: enquiry.country,
    tripSlug: enquiry.tripSlug,
    travellers: enquiry.travellers,
    preferredDates: enquiry.preferredDates,
    message: enquiry.message,
    restDays: enquiry.restDays,
    source: enquiry.source,
  }

  if (receipt) {
    /**
     * Answered now, sent after.
     *
     * `after` runs once the response has gone, so the traveller is not kept
     * waiting on two provider round trips for a message addressed to somebody
     * else. It is safe here only because the enquiry is already written down:
     * the office will see it whatever becomes of the mail, and the mail's own
     * fate is recorded on the panel's Email screen.
     */
    const id = receipt.id
    after(async () => {
      await deliverEnquiryMail({ enquiry: forMail, receipt }).catch((error) => {
        console.error('[enquiries] the mail for', id, 'failed outright', error)
      })
    })
    return NextResponse.json({ ok: true, id })
  }

  /**
   * Nothing was recorded, so the email *is* the enquiry.
   *
   * It is awaited rather than deferred, because whether it reached the office
   * is now the only honest answer to give the person waiting — and it carries
   * a notice saying it is the only copy there is.
   */
  const { officeSent } = await deliverEnquiryMail({ enquiry: forMail, receipt: null }).catch(
    (error) => {
      console.error('[enquiries] the enquiry reached nobody', error)
      return { officeSent: false }
    },
  )

  if (officeSent) return NextResponse.json({ ok: true })

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
