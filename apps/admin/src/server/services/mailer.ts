import 'server-only';

import { Prisma, type EmailStatus } from '@prisma/client';
import type { ApiEmailRecord } from '@lotuspeak/api-contracts';

import { db } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * The record of what the website sent, and what became of it.
 *
 * **This panel no longer sends anything.** The website renders both of an
 * enquiry's messages and hands them to the provider itself, because a panel
 * that is down, restarting, migrating or behind a broken deploy must not be
 * able to stop an enquiry reaching the office — and until this change it
 * could: the mail was sent from inside the same request that wrote the row, so
 * whatever took the panel down took the enquiry with it.
 *
 * What is left here is the half that needs a database, which is the half the
 * website cannot do:
 *
 * - **the log** — one row per message, written from the website's report, kept
 *   verbatim so the office can read what a traveller actually received;
 * - **the allowance** — counted out of that table and answered to the website
 *   when it records an enquiry, because nothing else knows how many messages
 *   today has already spent;
 * - **what happened next** — Resend's delivery notices arrive here, at the
 *   side that holds the record they belong to.
 *
 * ## The report is not the send
 *
 * A report that never arrives costs the office a row on a screen. A send that
 * never happens costs it a customer. So the website sends first and reports
 * afterwards, best-effort, and everything in this file is written to accept a
 * report that arrives late, twice, or not at all.
 */

/** Provider text kept at a length a table cell can show and a column can hold. */
const ERROR_MAX = 1_000;

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
/*  Writing down what the website sent                                         */
/* -------------------------------------------------------------------------- */

/** The statuses a website may report. Everything past SENT is the webhook's. */
const REPORTED: Record<ApiEmailRecord['status'], EmailStatus> = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
};

/**
 * Records messages the website has already dealt with.
 *
 * Keyed on the provider's id where there is one, so a report that arrives
 * twice — the website retried, a proxy replayed it — writes one row rather
 * than two. A message the provider never accepted has no id to key on and is
 * written afresh; a duplicate of one of those is a failure recorded twice,
 * which is untidy and harmless, where a lost success would not be.
 *
 * Nothing here throws for a bad row. The messages have *already been sent*,
 * and refusing the whole report because one of two had a field the schema
 * disliked would lose the record of the one that was fine.
 */
export async function recordDelivery(messages: ApiEmailRecord[]): Promise<number> {
  let recorded = 0;

  for (const message of messages) {
    const data = {
      kind: message.kind,
      /* Coerced, not trusted: the column is a foreign key, and an empty string
         refers to no template at all. A row refused for that reason is a
         message that went out with nothing on the Email screen to say so. */
      templateId: message.templateId || null,
      toEmail: message.toEmail,
      toName: message.toName,
      fromEmail: message.fromEmail,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      enquiryId: message.enquiryId,
      status: REPORTED[message.status] ?? 'QUEUED',
      providerId: message.providerId,
      error: message.error?.slice(0, ERROR_MAX) ?? null,
      /* One attempt is one handover, and the website only reports a message it
         has finished with. A QUEUED row was never handed over — no key on the
         website, nothing to count. */
      attempts: message.status === 'SENT' || message.status === 'FAILED' ? 1 : 0,
      sentAt: message.sentAt ? new Date(message.sentAt) : null,
      failedAt: message.status === 'FAILED' || message.status === 'SKIPPED' ? new Date() : null,
    };

    try {
      if (message.providerId) {
        /* `update` rather than `create` on the second arrival, and the update
           is deliberately narrow: a delivery notice may already have moved
           this row to DELIVERED, and a replayed report must not walk it back
           to SENT. */
        await db.emailMessage.upsert({
          where: { providerId: message.providerId },
          create: data,
          update: {},
        });
      } else {
        await db.emailMessage.create({ data });
      }
      recorded += 1;
    } catch (error) {
      console.error(
        `[mail] could not record the ${message.kind} to ${message.toEmail}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return recorded;
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
