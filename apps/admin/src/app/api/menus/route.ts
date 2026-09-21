import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';

const itemSchema = z.object({
  label: z.string().min(1, 'Give the link a label.').max(80),
  href: z.string().min(1, 'Where does it go?').max(500),
  isExternal: z.boolean().default(false),
  isCta: z.boolean().default(false),
});

const menuSchema = z.object({
  location: z.enum(['HEADER', 'FOOTER_ONE', 'FOOTER_TWO', 'FOOTER_THREE', 'LEGAL']),
  name: z.string().min(1).max(80),
  items: z.array(itemSchema).max(30),
});

const bodySchema = z.object({ menus: z.array(menuSchema).max(6) });

export const GET = route({
  permission: 'navigation.write',
  handler: async () => ({
    menus: await db.menu.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { location: 'asc' },
    }),
  }),
});

export const PUT = route<z.infer<typeof bodySchema>>({
  permission: 'navigation.write',
  schema: bodySchema,
  handler: async ({ body, audit }) => {
    /**
     * At most one call to action in the header.
     *
     * The design allows a single filled saffron button, and two would be a
     * design breach expressed as data — invisible in this screen and obvious
     * on the site.
     */
    for (const menu of body.menus) {
      const ctas = menu.items.filter((item) => item.isCta).length;
      if (ctas > 1) {
        throw new ApiError(
          422,
          'VALIDATION_FAILED',
          `“${menu.name}” has ${ctas} call-to-action links. The design allows one filled button; everything else is a plain link.`,
        );
      }
    }

    await db.$transaction(async (tx) => {
      for (const menu of body.menus) {
        const row = await tx.menu.upsert({
          where: { location: menu.location },
          create: { location: menu.location, name: menu.name },
          update: { name: menu.name },
        });

        await tx.menuItem.deleteMany({ where: { menuId: row.id } });
        await tx.menuItem.createMany({
          data: menu.items.map((item, index) => ({
            menuId: row.id,
            label: item.label,
            href: item.href,
            isExternal: item.isExternal || /^https?:\/\//i.test(item.href),
            isCta: item.isCta,
            sortOrder: index,
          })),
        });
      }
    });

    audit({ action: 'UPDATE', entity: 'menu', entityLabel: 'navigation' });

    return { revalidated: await revalidateFor('menu') };
  },
});
