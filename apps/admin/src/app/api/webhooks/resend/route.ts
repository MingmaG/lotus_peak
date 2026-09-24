import { createHmac, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { applyProviderEvent } from '@/server/services/mailer';

/**
 * Resend's delivery webhook.
 *
 * Without it the log stops at "the provider accepted this", which is the limit
 * of what a send call can honestly report. Acceptance is not arrival: the
 * interesting outcomes — delivered, bounced, marked as spam, delayed — all
 * happen minutes later and are only knowable from here. This is what turns the
 * Email screen from a list of attempts into a record of what reached people.
 *
 * ## Verification
 *
 * Resend signs with Svix. The signature covers `${id}.${timestamp}.${body}`,
 * HMAC-SHA256 with the secret, base64. The secret arrives from the dashboard
 * prefixed `whsec_`, and the bytes after that prefix are base64 — a common way
 * to get this wrong is to HMAC with the printable string instead of the
 * decoded key, which produces a signature that never matches and a webhook
 * that silently rejects everything.
 *
 * Three checks, and all three matter:
 *
 * - **The signature.** Compared in constant time, against every signature in
 *   the header: Svix sends a space-separated list during a secret rotation, so
 *   checking only the first would break every delivery notice mid-rotation.
 * - **The timestamp.** Outside five minutes the request is refused, because a
 *   valid signature is valid for ever and a captured request could otherwise
 *   be replayed to rewrite a message's history.
 * - **The raw body.** Verified before parsing, and the parse uses the exact
 *   same bytes. Re-serialising JSON and signing that is the other classic
 *   mistake — key order changes and nothing verifies.
 *
 * An unset secret means the endpoint is **off**, not open. A deployment that
 * has not configured it should refuse delivery notices, not accept unsigned
 * ones from anybody who finds the URL.
 *
 * ## Why it is not wrapped in `publicRoute`
 *
 * That helper answers in this application's envelope and turns a throw into a
 * 500, which is right for the website and wrong here: the caller is Svix, it
 * reads status codes only, and it retries anything that is not 2xx. A
 * malformed event must therefore answer 200 — retrying it will never help —
 * while a failure of *ours* must not, so the delivery is tried again.
 */

/** The node crypto above, and a body that must be read as raw bytes. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Svix rejects anything older than this, and so do we. */
const TOLERANCE_SECONDS = 5 * 60;

function verify(params: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
}): boolean {
  const { secret, id, timestamp, signatureHeader, body } = params;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  if (Math.abs(Date.now() / 1000 - seconds) > TOLERANCE_SECONDS) return false;

  /* `whsec_` prefixes a base64 key. Signing with the printable form is the
     mistake that makes a correctly configured webhook reject everything. */
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  const expectedBytes = Buffer.from(expected);

  /* The header is `v1,<sig> v1,<sig>` — more than one during a rotation. */
  return signatureHeader.split(' ').some((entry) => {
    const [version, signature] = entry.split(',');
    if (version !== 'v1' || !signature) return false;
    const provided = Buffer.from(signature);
    return provided.length === expectedBytes.length && timingSafeEqual(provided, expectedBytes);
  });
}

interface ResendWebhookBody {
  type?: unknown;
  created_at?: unknown;
  data?: { email_id?: unknown } | null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = env.mail.webhookSecret;
  if (!secret) {
    console.warn('[resend-webhook] refused: RESEND_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'The webhook is not configured.' }, { status: 503 });
  }

  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: 'Missing signature headers.' }, { status: 400 });
  }

  /* Read once, as text. Verification and parsing must see identical bytes. */
  const body = await request.text();

  if (!verify({ secret, id, timestamp, signatureHeader: signature, body })) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 401 });
  }

  let payload: ResendWebhookBody;
  try {
    payload = JSON.parse(body) as ResendWebhookBody;
  } catch {
    /* Signed, so it came from Resend, but unreadable. Retrying will not fix it. */
    return NextResponse.json({ ok: true, ignored: 'unparseable' });
  }

  const type = typeof payload.type === 'string' ? payload.type : null;
  const emailId =
    payload.data && typeof payload.data.email_id === 'string' ? payload.data.email_id : null;

  if (!type || !emailId) {
    return NextResponse.json({ ok: true, ignored: 'no type or email id' });
  }

  const occurredAt =
    typeof payload.created_at === 'string' && !Number.isNaN(Date.parse(payload.created_at))
      ? new Date(payload.created_at)
      : new Date();

  try {
    const result = await applyProviderEvent({ providerId: emailId, type, occurredAt, payload });

    /* An event for a message this database has never seen is almost always a
       webhook pointed at the wrong environment. Answer 200 so Resend stops
       retrying it, and say so in the reply rather than pretending it applied. */
    return NextResponse.json({ ok: true, applied: result.applied });
  } catch (error) {
    /* Our failure, not theirs: let Resend try again. */
    console.error('[resend-webhook] could not record the event:', error);
    return NextResponse.json({ error: 'Could not record the event.' }, { status: 500 });
  }
}
