import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { MEDIA_THUMB } from '@/server/services/resource';
import { serialiseMediaRow } from '@/server/services/media-serialise';

/**
 * The four seasons.
 *
 * Read only as a set, and never created or deleted: there are four, there will
 * always be four, and the home page's band has four panels. Editing one is
 * `PATCH /api/seasons/[key]`.
 */
export const GET = route({
  permission: 'seasons.read',
  handler: async () => {
    const rows = await db.season.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { image: MEDIA_THUMB },
    });
    return {
      items: rows.map((row) => ({
        ...row,
        image: row.image ? serialiseMediaRow(row.image) : null,
      })),
    };
  },
});
