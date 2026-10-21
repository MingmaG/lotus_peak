import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { ok, publicRoute } from '@/lib/api/public';
import { recordDelivery } from '@/server/services/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the website sent, on its way into the log.
 *
 * The website renders and hands over an enquiry's two messages itself, so that
 * this panel being down cannot stop an enquiry reaching the office. The record
 * of them still belongs here — the Email screen reads it, the provider's
 * delivery notices attach to it, the daily allowance is counted from it — and
 * this is how it arrives.
 *
 * **It reports; it does not ask.** By the time a request lands here the
 * messages have already gone. Nothing this endpoint can answer will unsend
 * them, which is why every failure below is answered as plainly as possible
 * and why a row the schema dislikes is dropped rather than made to fail its
 * neighbour.
 *
 * ## Why a shared secret and not the signature the other seam uses
 *
 * Publishing signs an HMAC over its payload because it travels to a route that
 * drops caches and the payload is small. This one carries two rendered emails,
 * runs over TLS between two of our own services, and is idempotent on replay —
 * a repeated report writes the same row, keyed on the provider's id. A bearer
 * secret is the honest amount of ceremony for that.
 *
 * What it is emphatically not is optional: this endpoint writes the office's
 * record of what a traveller received. Unset means **off**, so a deployment
 * that forgot to configure it has an empty Email screen — which /api/health
 * and Settings both say out loud — rather than one anybody on the internet can
 * write to.
 */

/** Long enough for a rendered email, short enough not to be a place to store things. */
const BODY_MAX = 200_000;

const record = z.object({
  kind: z.enum([
    'ENQUIRY_ACKNOWLEDGEMENT',
    'ENQUIRY_NOTIFICATION',
    'NEWSLETTER_WELCOME',
    'NEWSLETTER_CONFIRM',
    'PASSWORD_RESET',
  ]),
  templateId: z.string().max(60).nullable(),
  toEmail: z.string().email().max(200),
  toName: z.string().max(200).nullable(),
  fromEmail: z.string().max(200),
  replyTo: z.string().max(200).nullable(),
  subject: z.string().max(500),
  html: z.string().max(BODY_MAX),
  text: z.string().max(BODY_MAX),
  enquiryId: z.string().max(60).nullable(),
  status: z.enum(['QUEUED', 'SENT', 'FAILED', 'SKIPPED']),
  providerId: z.string().max(200).nullable(),
  error: z.string().max(2_000).nullable(),
  sentAt: z.string().datetime().nullable(),
});

const schema = z.object({ messages: z.array(record).max(10) });

export const POST = publicRoute('/api/public/emails', async (request: NextRequest) => {
  if (!env.mail.reportSecret) {
    console.warn(
      '[mail] a delivery report was refused: MAIL_REPORT_SECRET is not set, so nothing the website sends can be recorded.',
    );
    return NextResponse.json(
      { error: { code: 'NOT_CONFIGURED', message: 'Delivery reports are not accepted here.' } },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  if (!authorised(request.headers.get('authorization'))) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORISED', message: 'Not accepted.' } },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    /* Loud, because it means messages went out that the office cannot see, and
       nothing on any screen would say so. */
    console.error('[mail] a delivery report did not parse:', parsed.error.issues);
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'That is not a delivery report.' } },
      { status: 422, headers: { 'cache-control': 'no-store' } },
    );
  }

  return ok({ recorded: await recordDelivery(parsed.data.messages) });
});

/**
 * The secret, compared in constant time.
 *
 * `timingSafeEqual` throws on a length mismatch rather than returning false,
 * so the lengths are checked first — and the check is on bytes, because a
 * secret with a multi-byte character in it has a length in characters that is
 * not its length in bytes.
 */
function authorised(header: string | null): boolean {
  const provided = Buffer.from(header?.replace(/^Bearer\s+/i, '').trim() ?? '');
  const expected = Buffer.from(env.mail.reportSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
