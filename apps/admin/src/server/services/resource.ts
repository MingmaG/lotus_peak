import 'server-only';

import { db } from '@/lib/db';

/**
 * The three things every small content type's routes need, and nothing else.
 *
 * There was a generic `resourceRoutes(config)` here that built list, create,
 * reorder, patch and delete from a configuration object. It was deleted. Two
 * of the five types needed a join written alongside the row, which meant the
 * config grew hooks, and the create route ended up cloning its own request to
 * read a field the generic path had thrown away — more code than the routes it
 * replaced, and harder to follow.
 *
 * What is genuinely shared is below: finding a free slug, and the next
 * position in a list. Everything else lives in the route, where the difference
 * between a gallery image and a reflection is visible.
 */

type SlugTable = 'destination' | 'activity' | 'cultureArticle' | 'post' | 'page';

export async function freeSlug(table: SlugTable, desired: string): Promise<string> {
  const rows =
    table === 'destination'
      ? await db.destination.findMany({ select: { slug: true } })
      : table === 'activity'
        ? await db.activity.findMany({ select: { slug: true } })
        : table === 'post'
          ? await db.post.findMany({ select: { slug: true } })
          : table === 'page'
            ? await db.page.findMany({ select: { slug: true } })
            : await db.cultureArticle.findMany({ select: { slug: true } });

  const taken = new Set(rows.map((row) => row.slug));
  const root =
    desired
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 120) || 'untitled';

  if (!taken.has(root)) return root;
  for (let n = 2; n < 500; n += 1) {
    if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

/** Media, included at the size a form and a list need. */
export const MEDIA_THUMB = {
  include: { renditions: { where: { format: 'webp' as const } } },
};
