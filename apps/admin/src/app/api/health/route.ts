import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { env, mailConfigured, revalidationConfigured } from '@/lib/env';
import { storage } from '@/lib/storage';

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

  checks.mail = mailConfigured()
    ? { ok: true }
    : { ok: false, detail: 'RESEND_API_KEY is not set. Enquiries are recorded and logged, not sent.' };

  /* The database is the only fatal one. A missing mail key is a warning: the
     panel works, and an enquiry is still recorded. */
  const status = checks.database?.ok ? 200 : 503;
  return NextResponse.json({ ok: status === 200, checks }, { status });
}
