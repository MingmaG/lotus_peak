import { z } from 'zod';
import type { SeasonKey } from '@prisma/client';

import { db } from '@/lib/db';
import { badRequest, notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { revalidateFor } from '@/server/services/revalidate';
import { seasonSchema } from '@/server/validators/catalogue';

const KEYS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;
const patchSchema = seasonSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { key: string }>({
  permission: 'seasons.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const key = params.key.toUpperCase() as SeasonKey;
    if (!KEYS.includes(key as (typeof KEYS)[number])) {
      throw badRequest(`There is no season called "${params.key}".`);
    }

    const before = await db.season.findUnique({ where: { key } });
    if (!before) throw notFound('That season');

    const row = await db.season.update({
      where: { key },
      data: {
        name: body.name,
        monthsLabel: body.monthsLabel,
        headline: body.headline,
        summary: body.summary,
        detail: body.detail,
        imageId: body.imageId === undefined ? undefined : body.imageId,
      },
    });

    const changes = diff(before as never, row as never);
    audit({
      action: 'UPDATE',
      entity: 'season',
      entityId: row.id,
      entityLabel: row.name,
      before: changes.before as never,
      after: changes.after as never,
    });

    return { item: row, revalidated: await revalidateFor('season') };
  },
});
