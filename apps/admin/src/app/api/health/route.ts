import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { env, mailConfigured, mailWebhookConfigured, revalidationConfigured } from '@/lib/env';
import { storage } from '@/lib/storage';
import { checkQuota } from '@/server/services/mailer';

/**
 * Is this install actually working?
 *
 * Deliberately more than "the process is up". A deploy where the database is
 * reachable but the revalidation secret was never set is a deploy where
 * publishing appears to work and never reaches the website — and the only
 * symptom is an editor saying the site looks old. This endpoint says so.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (error) {
    checks.database = { ok: false, detail: (error as Error).message };
  }

  try {
    await storage.exists('media/__healthcheck__');
    checks.storage = { ok: true, detail: storage.name };
  } catch (error) {
    checks.storage = { ok: false, detail: (error as Error).message };
  }

  checks.revalidation = revalidationConfigured()
    ? { ok: true, detail: env.site.url }
    : {
        ok: false,
        detail:
          'SITE_REVALIDATE_SECRET is not set. Publishing will not reach the website until the hourly refresh.',
      };

  if (!mailConfigured()) {
    checks.mail = {
      ok: false,
      detail: 'RESEND_API_KEY is not set. Enquiries are recorded and logged, not sent.',
    };
  } else {
    /* The allowance is worth reporting even when it is not yet spent: a deploy
       whose cap is nearly gone will start recording enquiries as SKIPPED, and
       finding that out from a silent traveller is finding out too late. */
    const quota = await checkQuota().catch(() => null);
    checks.mail = quota
      ? {
          ok: quota.remaining > 0,
          detail:
            quota.remaining > 0
              ? `${quota.usedToday} of ${quota.cap} sent today.`
              : `The daily allowance of ${quota.cap} is spent. Messages are being recorded as skipped until ${quota.resetsAt}.`,
        }
      : { ok: true };
  }

  /* Not fatal, and not cosmetic: without it every message stops at SENT, which
     only means the provider took it. A bounce is then invisible. */
  checks.mailWebhook = mailWebhookConfigured()
    ? { ok: true, detail: `${env.storage.adminPublicUrl}/api/webhooks/resend` }
    : {
        ok: false,
        detail:
          'RESEND_WEBHOOK_SECRET is not set. Messages will stop at "sent" — a bounce or a complaint will never be recorded.',
      };

  /* The database is the only fatal one. A missing mail key is a warning: the
     panel works, and an enquiry is still recorded. */
  const status = checks.database?.ok ? 200 : 503;
  return NextResponse.json({ ok: status === 200, checks }, { status });
}
