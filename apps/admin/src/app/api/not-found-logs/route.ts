import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';

/**
 * What the website's 404 handler saw.
 *
 * The useful column is the referrer: a 404 arriving with one from another site
 * is a real inbound link somebody should keep, and one with no referrer is
 * usually a bot guessing at `/wp-admin`.
 */
export const GET = route({
  permission: 'seo.read',
  handler: async ({ searchParams }) => {
    const resolved = searchParams.get('resolved') === '1';
    return {
      items: await db.notFoundLog.findMany({
        where: { resolved },
        orderBy: [{ hitCount: 'desc' }, { lastHitAt: 'desc' }],
        take: 100,
      }),
    };
  },
});

const patchSchema = z.object({
  paths: z.array(z.string()).min(1).max(100),
  resolved: z.boolean(),
});

export const PATCH = route<z.infer<typeof patchSchema>>({
  permission: 'seo.write',
  schema: patchSchema,
  handler: async ({ body, audit }) => {
    await db.notFoundLog.updateMany({
      where: { path: { in: body.paths } },
      data: { resolved: body.resolved },
    });
    audit({
      action: 'UPDATE',
      entity: 'notFound',
      entityLabel: `${body.paths.length} path(s)`,
    });
    return null;
  },
});
