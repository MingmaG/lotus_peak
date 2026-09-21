import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

const schema = z.object({
  path: z.string().min(1).max(500),
  referrer: z.string().max(500).nullable().optional(),
});

/**
 * The website telling us something was asked for and not found.
 *
 * Unauthenticated, like the enquiry endpoint, and for the same reason: the
 * caller is the website, which holds no credential. It is a much smaller
 * target — the worst somebody can do with it is fill a table with paths — but
 * it is still worth the two guards it has: one row per path with a count
 * rather than a row per hit, and a hard cap on how many distinct paths are
 * kept.
 */
export const POST = publicRoute('/api/public/not-found', async (request: NextRequest) => {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return ok({ recorded: false });

  const { path, referrer } = parsed.data;

  const existing = await db.notFoundLog.findUnique({ where: { path } });

  if (existing) {
    await db.notFoundLog.update({
      where: { path },
      data: {
        hitCount: { increment: 1 },
        lastHitAt: new Date(),
        /* A referrer arriving on a later hit is worth keeping: the first hit
           was often a bot, and the one with a referrer is the real link. */
        referrer: referrer || existing.referrer,
      },
    });
    return ok({ recorded: true });
  }

  /**
   * A cap on distinct paths.
   *
   * A scanner walks ten thousand made-up URLs in an afternoon, and without
   * this the table is ten thousand rows of noise with the four real broken
   * links buried in it. Past the cap, only a miss that carries a referrer —
   * which is to say a real inbound link — is recorded.
   */
  const distinct = await db.notFoundLog.count({ where: { resolved: false } });
  if (distinct > 500 && !referrer) return ok({ recorded: false });

  await db.notFoundLog.create({
    data: {
      path,
      referrer: referrer || null,
      userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
  });

  return ok({ recorded: true });
});
