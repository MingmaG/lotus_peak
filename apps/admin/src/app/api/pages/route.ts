import { z } from 'zod';

import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { publishing, seoColumns } from '@/server/services/catalogue';
import { freeSlug } from '@/server/services/resource';
import { revalidateFor } from '@/server/services/revalidate';
import { pageSchema } from '@/server/validators/page';
import { toPath } from '@/lib/slug';

export const GET = route({
  permission: 'pages.read',
  handler: async () => ({
    items: await db.page.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { path: 'asc' }],
      select: {
        id: true,
        slug: true,
        path: true,
        title: true,
        lead: true,
        status: true,
        isSystem: true,
        showInSitemap: true,
        sections: true,
        updatedAt: true,
      },
    }),
  }),
});

export const POST = route<z.infer<typeof pageSchema>>({
  permission: 'pages.write',
  schema: pageSchema,
  handler: async ({ body, audit }) => {
    const slug = await freeSlug('page', body.slug || body.title);

    const row = await db.page.create({
      data: {
        slug,
        path: body.path ?? toPath(slug),
        title: body.title,
        eyebrow: body.eyebrow || null,
        lead: body.lead || null,
        sections: body.sections as never,
        heroId: body.heroId ?? null,
        showInSitemap: body.showInSitemap,
        sortOrder: body.sortOrder ?? (await db.page.count()),
        ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
        ...seoColumns(body.seo),
      },
    });

    audit({ action: 'CREATE', entity: 'page', entityId: row.id, entityLabel: row.title });
    if (row.status === 'PUBLISHED') void revalidateFor('page', [row.path]);
    return { page: row };
  },
});
