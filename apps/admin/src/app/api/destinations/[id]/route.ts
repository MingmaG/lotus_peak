import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { updateDestination } from '@/server/services/destination-save';
import { revalidateFor } from '@/server/services/revalidate';
import { destinationSchema } from '@/server/validators/catalogue';

const patchSchema = destinationSchema.partial();

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'destinations.write',
  schema: patchSchema,
  handler: async ({ params, body, audit }) => {
    const { before, row, path: newPath, paths } = await updateDestination(params.id, body);

    const changes = diff(before as never, row as never);
    audit({
      action: 'UPDATE',
      entity: 'destination',
      entityId: row.id,
      entityLabel: row.name,
      before: changes.before as never,
      after: changes.after as never,
    });

    const push = await revalidateFor('destination', paths);
    return { destination: row, path: newPath, revalidated: push };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'destinations.delete',
  handler: async ({ params, audit }) => {
    const row = await db.destination.findUnique({
      where: { id: params.id },
      include: { _count: { select: { places: { where: { deletedAt: null } } } } },
    });
    if (!row) throw notFound('That place');

    /**
     * A valley with places in it is not removed.
     *
     * Its places' addresses are made of its slug, and a place whose valley has
     * gone has no URL at all. Moving them or removing them first is one extra
     * step for the office and no orphaned pages for anybody.
     */
    if (row._count.places > 0) {
      throw new ApiError(
        409,
        'HAS_PLACES',
        `${row.name} still has ${row._count.places} place${row._count.places === 1 ? '' : 's'} in it. Move or remove those first.`,
      );
    }

    /**
     * Soft, like everything else that a journey points at.
     *
     * A hard delete would cascade the join rows and silently shorten every
     * route through this place — and "why did the sacred valleys journey stop
     * mentioning Trongsa" is a much worse afternoon than a row that is still
     * there and hidden.
     */
    await db.destination.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    audit({ action: 'DELETE', entity: 'destination', entityId: row.id, entityLabel: row.name });
    void revalidateFor('destination');
    return null;
  },
});
