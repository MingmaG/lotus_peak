import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { changeSlug } from '@/server/services/publish';
import { publishing, seoColumns } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { pagePatchSchema, type PagePatch } from '@/server/validators/page';

export const GET = route<undefined, { id: string }>({
  permission: 'pages.read',
  handler: async ({ params }) => {
    const page = await db.page.findUnique({
      where: { id: params.id },
      include: {
        hero: { include: { renditions: { where: { format: 'webp' } } } },
        ogImage: { include: { renditions: { where: { format: 'webp' } } } },
        trips: { orderBy: { sortOrder: 'asc' }, select: { tripId: true } },
        people: { orderBy: { sortOrder: 'asc' }, select: { personId: true } },
      },
    });
    if (!page) throw notFound('That page');
    return { page };
  },
});

export const PATCH = route<PagePatch, { id: string }>({
  permission: 'pages.write',
  schema: pagePatchSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.page.findUnique({ where: { id: params.id } });
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
      where: { id: params.id },
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

    const changes = diff(before as never, page as never);
    audit({
      action: body.status === 'PUBLISHED' && before.status !== 'PUBLISHED' ? 'PUBLISH' : 'UPDATE',
      entity: 'page',
      entityId: page.id,
      entityLabel: page.title,
      before: changes.before as never,
      after: changes.after as never,
    });

    const paths = [page.path];
    if (before.path !== page.path) paths.push(before.path);

    return { page, revalidated: await revalidateFor('page', paths) };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'pages.delete',
  handler: async ({ params, audit }) => {
    const page = await db.page.findUnique({ where: { id: params.id } });
    if (!page) throw notFound('That page');

    if (page.isSystem) {
      throw new ApiError(
        409,
        'SYSTEM_PAGE',
        `“${page.title}” is one of the site's fixed routes and cannot be deleted. Unpublishing it would leave the route rendering nothing.`,
      );
    }

    await db.page.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    audit({ action: 'DELETE', entity: 'page', entityId: page.id, entityLabel: page.title });
    void revalidateFor('page', [page.path]);
    return null;
  },
});
