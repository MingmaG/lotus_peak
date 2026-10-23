import 'server-only';

import type { Page } from '@prisma/client';

import { ApiError, notFound } from '@/lib/api/handler';
import { db } from '@/lib/db';
import type { PagePatch } from '@/server/validators/page';
import { publishing, seoColumns } from './catalogue';
import { changeSlug } from './publish';

/**
 * Saving an editorial page.
 *
 * Here rather than in the route because two doors lead to it — the panel's
 * editor and an AI client over MCP — and a rule written into one of them is a
 * rule the other does not have. "A system page keeps its address" is the one
 * that matters most.
 */
export async function updatePage(id: string, body: PagePatch): Promise<{ before: Page; page: Page }> {
  const before = await db.page.findUnique({ where: { id } });
  if (!before) throw notFound('That page');

  /**
   * A system page keeps its address.
   *
   * Home and Contact are routes the site has components for. Moving `/` to
   * `/home` would leave the home page rendering nothing, and the failure
   * looks like a caching problem rather than an edit.
   */
  if (before.isSystem && body.path && body.path !== before.path) {
    throw new ApiError(
      409,
      'SYSTEM_PAGE',
      `“${before.title}” is one of the site's fixed routes, so its address cannot change. Everything on it can.`,
    );
  }

  let slug = before.slug;
  let slugHistory = before.slugHistory;
  let path = before.path;

  if (body.path && body.path !== before.path && !before.isSystem) {
    const moved = await changeSlug({
      entity: 'page',
      currentSlug: before.path,
      nextSlug: body.path.replace(/^\//, ''),
      currentHistory: before.slugHistory,
      pathPrefix: '',
    });
    path = `/${moved.slug}`;
    slug = moved.slug;
    slugHistory = moved.slugHistory;
  }

  const page = await db.page.update({
    where: { id },
    data: {
      slug,
      path,
      slugHistory,
      title: body.title,
      eyebrow: body.eyebrow === undefined ? undefined : body.eyebrow || null,
      lead: body.lead === undefined ? undefined : body.lead || null,
      note: body.note === undefined ? undefined : body.note || null,
      sections: body.sections === undefined ? undefined : (body.sections as never),
      heroId: body.heroId === undefined ? undefined : body.heroId,
      showInSitemap: body.showInSitemap,
      sortOrder: body.sortOrder,
      ...publishing({
        next: body.status,
        currentStatus: before.status,
        currentPublishedAt: before.publishedAt,
      }),
      ...seoColumns(body.seo),
      ...(body.tripIds
        ? {
            trips: {
              deleteMany: {},
              create: body.tripIds.map((tripId, index) => ({ tripId, sortOrder: index })),
            },
          }
        : {}),
      ...(body.personIds
        ? {
            people: {
              deleteMany: {},
              create: body.personIds.map((personId, index) => ({ personId, sortOrder: index })),
            },
          }
        : {}),
    },
  });

  return { before, page };
}
