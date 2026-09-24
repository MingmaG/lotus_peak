import 'server-only';

import { Prisma, type EmailKind, type EmailStatus } from '@prisma/client';

import { db } from '@/lib/db';
import { env, mailConfigured } from '@/lib/env';

/**
 * Handing a message to Resend, and writing down what became of it.
 *
 * Two jobs in one file because they are one sequence, and the order is the
 * whole point: **write the record first, then do the thing that can fail.** A
 * message is stored before Resend is called, marked `PROCESSING` as it is
 * handed over, and `SENT` or `FAILED` by what comes back. A crash anywhere in
 * the middle leaves a row that says exactly how far it got.
 *
 * A log written only *after* a send completes cannot show a send that never
 * completed — and "the acknowledgement is stuck" is precisely the thing the
 * office needs to see.
 *
 * ## Why `fetch` and not the SDK
 *
 * The request is one POST. `resend` would be a dependency, a version to keep
 * up and a wrapper over the same call; swapping in Postmark or Brevo means
 * rewriting {@link handOver} alone. §7 of the monorepo's rules says not to add
 * a dependency for what a small module does, and this is that module.
 *
 * ## Why an API and not SMTP
 *
 * A fresh server's IP has no sending reputation and cannot sign as the
 * company's domain, so mail either lands in spam or is refused outright. The
 * provider signs with DKIM for the domain instead.
 *
 * ## Recording is not optional; sending is
 *
 * With no `RESEND_API_KEY` the message is rendered, stored `QUEUED` and
 * logged. That is the correct development default — a seeded database full of
 * test addresses must not be able to email anybody — and it is what makes the
 * Email screen useful on day one: the office can read exactly what *would* go
 * out before a key is ever set.
 */

const ENDPOINT = 'https://api.resend.com/emails';

/** Long enough for a slow provider, short enough not to hold a request open. */
const TIMEOUT_MS = 10_000;

/** Provider text kept at a length a table cell can show and a column can hold. */
const ERROR_MAX = 1_000;

export interface OutgoingEmail {
  kind: EmailKind;
  toEmail: string;
  toName?: string | null;
  /** Where the recipient's "Reply" goes. Not the same as the From address. */
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  /** The template the words came from, for the Email screen's "Kind" column. */
  templateId?: string | null;
  enquiryId?: string | null;
}

export interface SendResult {
  id: string;
  status: EmailStatus;
  /** True only when Resend accepted it. Acceptance is not arrival. */
  sent: boolean;
  error?: string;
}

/* -------------------------------------------------------------------------- */
/*  The daily allowance                                                        */
/* -------------------------------------------------------------------------- */

export interface QuotaReport {
  cap: number;
  /** Everything actually handed over today, whatever became of it. */
  usedToday: number;
  remaining: number;
  /** When the count resets, as an ISO timestamp. */
  resetsAt: string;
}

/** Midnight tonight, UTC. The provider's day, not the office's. */
function endOfDayUtc(now = new Date()): Date {
  const end = new Date(now);
  end.setUTCHours(24, 0, 0, 0);
  return end;
}

function startOfDayUtc(now = new Date()): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * How much of today's allowance is left.
 *
 * Counts what was *attempted*, not what succeeded: a bounce still spent the
 * send. `QUEUED` and `SKIPPED` are excluded because by definition nothing was
 * handed over for either, and counting `SKIPPED` would make the cap eat
 * itself — every refusal would consume the allowance it was refused for.
 */
export async function checkQuota(): Promise<QuotaReport> {
  const cap = env.mail.dailyCap;

  const usedToday = await db.emailMessage.count({
    where: {
      createdAt: { gte: startOfDayUtc() },
      status: { notIn: ['QUEUED', 'SKIPPED'] },
    },
  });

  return {
    cap,
    usedToday,
    remaining: Math.max(0, cap - usedToday),
    resetsAt: endOfDayUtc().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Sending                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Records one message and, if it may be, sends it.
 *
 * Never throws for a delivery failure. The caller is an enquiry that has
 * already been written down, and a provider having a bad afternoon must not
 * turn into an error on a form somebody filled in — the failure belongs in the
 * row, where the Email screen shows it, not in the traveller's face.
 */
export async function sendEmail(message: OutgoingEmail): Promise<SendResult> {
  const quota = await checkQuota();

  /* Over the cap it is not QUEUED, because nothing is going to happen to it.
     Saying QUEUED would leave the office waiting for a send that was never
     going to be attempted. */
  const allowed = quota.remaining > 0;

  /**
   * Stored before it is sent, and stored verbatim.
   *
   * A template edited next week must not change the record of what somebody
   * received — which is why `html` and `text` are columns rather than a
   * template id plus the inputs.
   */
  const row = await db.emailMessage.create({
    data: {
      kind: message.kind,
      templateId: message.templateId ?? null,
      toEmail: message.toEmail,
      toName: message.toName ?? null,
      fromEmail: env.mail.from,
      replyTo: message.replyTo ?? null,
      subject: message.subject,
      html: message.html,
      text: message.text,
      enquiryId: message.enquiryId ?? null,
      status: allowed ? 'QUEUED' : 'SKIPPED',
      ...(allowed
        ? {}
        : {
            error: `The daily sending allowance of ${quota.cap} was already spent.`,
            failedAt: new Date(),
          }),
    },
    select: { id: true },
  });

  if (!allowed) {
    console.warn(
      `[mail] not sent (daily cap of ${quota.cap} reached): "${message.subject}" → ${message.toEmail}`,
    );
    return { id: row.id, status: 'SKIPPED', sent: false, error: 'Daily cap reached.' };
  }

  if (!mailConfigured()) {
    console.info(
      `[mail] not sent (RESEND_API_KEY is unset): "${message.subject}" → ${message.toEmail}`,
    );
    return { id: row.id, status: 'QUEUED', sent: false };
  }

  /* Counted on the handover rather than on the answer, so a send that hangs
     and is tried again still reads as two attempts. */
  await db.emailMessage.update({
    where: { id: row.id },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  try {
    const providerId = await handOver(message);
    await db.emailMessage.update({
      where: { id: row.id },
      data: { status: 'SENT', sentAt: new Date(), providerId, error: null, failedAt: null },
    });
    return { id: row.id, status: 'SENT', sent: true };
  } catch (error) {
    const detail = (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);
    await db.emailMessage.update({
      where: { id: row.id },
      data: { status: 'FAILED', error: detail, failedAt: new Date() },
    });
    console.error(`[mail] ${message.kind} to ${message.toEmail} failed:`, detail);
    return { id: row.id, status: 'FAILED', sent: false, error: detail };
  }
}

/**
 * The one POST. Returns Resend's id for the message.
 *
 * That id is what a delivery or bounce notice arrives quoting, so losing it
 * costs the message its later history — but the mail did go, so a body that
 * does not parse is swallowed rather than thrown.
 */
async function handOver(message: OutgoingEmail): Promise<string | null> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.mail.resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.mail.from,
      to: [message.toEmail],
      reply_to: message.replyTo || env.mail.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
    /* Never let a hanging provider hold a request open. Without this the
       fetch has no deadline at all and an enquiry submission waits on it. */
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 400)}`);
  }

  try {
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === 'string' ? body.id : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  What became of it                                                          */
/* -------------------------------------------------------------------------- */

/**
 * What each of Resend's events means for the message it names.
 *
 * `email.sent` is deliberately absent: the send call already recorded that,
 * and it would tell us nothing we did not write down ourselves. So are
 * `email.scheduled` and `email.received`, which this application never
 * produces. Both are still appended to the event log — every event is — they
 * simply move nothing.
 */
const TRANSITIONS: Record<string, { status: EmailStatus; at?: 'deliveredAt' | 'openedAt' | 'failedAt' }> = {
  'email.delivered': { status: 'DELIVERED', at: 'deliveredAt' },
  'email.opened': { status: 'OPENED', at: 'openedAt' },
  'email.clicked': { status: 'CLICKED' },
  'email.bounced': { status: 'BOUNCED', at: 'failedAt' },
  'email.complained': { status: 'COMPLAINED' },
  'email.delivery_delayed': { status: 'PROCESSING' },
  /* Accepted and then abandoned. It is not a bounce — no mailbox refused it —
     but nothing arrived, and a row still reading "Sent" would say it did. */
  'email.failed': { status: 'FAILED', at: 'failedAt' },
  /* Never attempted: the address is on Resend's suppression list, usually
     because it bounced or complained on an earlier message. The most
     misleading of all of them to leave as "Sent". */
  'email.suppressed': { status: 'FAILED', at: 'failedAt' },
};

/**
 * How far along a status is, so a late event cannot walk one backwards.
 *
 * Provider events do not arrive in the order they happened. Without this, a
 * `delivery_delayed` notice landing after the message was delivered drags a
 * finished message back into the "still working" list, and a `delivered`
 * arriving after an `opened` loses the open. A status only moves forward.
 *
 * The three failures sit above everything: a message that bounced did not
 * arrive, whatever a note of progress says afterwards.
 */
const RANK: Record<EmailStatus, number> = {
  QUEUED: 0,
  SKIPPED: 0,
  PROCESSING: 1,
  SENT: 2,
  DELIVERED: 3,
  OPENED: 4,
  CLICKED: 5,
  FAILED: 9,
  BOUNCED: 9,
  COMPLAINED: 9,
};

/**
 * Bad news, which always applies.
 *
 * Ranking alone would refuse a complaint about a message that already bounced,
 * and "they marked it as spam" is worth recording either way.
 */
const ALWAYS: EmailStatus[] = ['BOUNCED', 'COMPLAINED'];

/**
 * Applies one provider event to the message it names.
 *
 * Keyed on the provider's own id, the only thing a webhook carries that means
 * anything here. An event for a message this database has never seen is
 * dropped rather than stored orphaned — it is almost always a webhook pointed
 * at the wrong environment, and a log full of unattached events is harder to
 * read than one that is honest about its scope.
 *
 * Every event is appended whatever the status; only some of them move it.
 */
export async function applyProviderEvent(input: {
  providerId: string;
  type: string;
  occurredAt: Date;
  payload?: unknown;
}): Promise<{ applied: boolean; status?: EmailStatus }> {
  const message = await db.emailMessage.findUnique({
    where: { providerId: input.providerId },
    select: { id: true, status: true },
  });
  if (!message) return { applied: false };

  const next = TRANSITIONS[input.type];
  const moves =
    next && (ALWAYS.includes(next.status) || RANK[next.status] > RANK[message.status]);

  await db.$transaction(async (tx) => {
    await tx.emailEvent.create({
      data: {
        messageId: message.id,
        type: input.type,
        status: moves ? next.status : null,
        occurredAt: input.occurredAt,
        payload: (input.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    if (!moves) return;

    await tx.emailMessage.update({
      where: { id: message.id },
      data: {
        status: next.status,
        ...(next.at ? { [next.at]: input.occurredAt } : {}),
      },
    });
  });

  return { applied: true, status: moves ? next.status : message.status };
}
