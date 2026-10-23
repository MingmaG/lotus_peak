import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { updatePage } from '@/server/services/page';
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
    const { before, page } = await updatePage(params.id, body);

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
