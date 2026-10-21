import { db } from '@/lib/db';
import {
  storedPageSectionsSchema,
  type StoredPageSection,
} from '@/server/schema/blocks';

import type { ImageMap } from './media';
import pages from '../seed-data/pages.json';

/**
 * The editorial pages, and the navigation.
 *
 * `scripts/export-pages.ts` in the website produced the sections; this turns
 * the photograph *paths* in them into media ids, the same translation the
 * journal needs and for the same reason.
 */

interface PageSectionJson {
  kind: string;
  [key: string]: unknown;
}

interface PageJson {
  slug: string;
  path: string;
  title: string;
  eyebrow: string | null;
  lead: string | null;
  note?: string | null;
  heroSrc: string | null;
  sections: PageSectionJson[];
  isSystem: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  sitemapPriority: number;
}

export async function seedPages(images: ImageMap): Promise<void> {
  const now = new Date();

  for (const page of pages as PageJson[]) {
    const sections: StoredPageSection[] = [];

    for (const raw of page.sections) {
      if (raw.kind === 'figure') {
        const mediaId = images.get(String(raw.imageSrc ?? ''));
        if (!mediaId) {
          console.warn(`    ${page.path}: dropped a figure, ${raw.imageSrc} is not in the library`);
          continue;
        }
        sections.push({
          kind: 'figure',
          mediaId,
          caption: (raw.caption as string | null) ?? null,
          width: (raw.width as 'full' | 'inset') ?? 'inset',
        });
        continue;
      }
      sections.push(raw as unknown as StoredPageSection);
    }

    const base = {
      title: page.title,
      eyebrow: page.eyebrow,
      lead: page.lead,
      note: page.note ?? null,
      sections: storedPageSectionsSchema.parse(sections),
      heroId: page.heroSrc ? (images.get(page.heroSrc) ?? null) : null,
      isSystem: page.isSystem,
      showInSitemap: true,
      status: 'PUBLISHED' as const,
      publishedAt: now,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      sitemapPriority: page.sitemapPriority,
      sitemapChangeFreq: page.path === '/' ? 'weekly' : 'monthly',
    };

    await db.page.upsert({
      where: { slug: page.slug },
      create: { slug: page.slug, path: page.path, ...base },
      update: { path: page.path, ...base },
    });
  }

  console.log(`  pages        ${pages.length}`);
}

/**
 * The header and the three footer columns, from `SETTINGS.nav` and
 * `SETTINGS.footer` in the website.
 *
 * Seeded only when the menus are empty. The navigation is the first thing an
 * office rearranges, and a re-seed that put "Our trips" back at the top after
 * they moved it is the kind of helpfulness that makes people stop running
 * commands.
 */
export async function seedNavigation(): Promise<void> {
  if ((await db.menu.count()) > 0) {
    console.log('  navigation   already present, left alone');
    return;
  }

  const header = await db.menu.create({
    data: { name: 'Header', location: 'HEADER' },
  });

  await db.menuItem.createMany({
    data: [
      { menuId: header.id, label: 'Our trips', href: '/trips', sortOrder: 1 },
      { menuId: header.id, label: 'Where we go', href: '/destinations', sortOrder: 2 },
      { menuId: header.id, label: 'Culture', href: '/culture', sortOrder: 3 },
      { menuId: header.id, label: 'Journal', href: '/journal', sortOrder: 4 },
      { menuId: header.id, label: 'About', href: '/about', sortOrder: 5 },
      { menuId: header.id, label: 'Contact', href: '/contact', sortOrder: 6 },
      /**
       * The one filled button in the header.
       *
       * `isCta` rather than a separate `navCta` setting, so the office can
       * make any link the call to action by ticking a box — and the editor
       * enforces at most one, because the design allows a single saffron
       * button and two would be a design breach expressed as data.
       */
      { menuId: header.id, label: 'Explore trips', href: '/trips', isCta: true, sortOrder: 7 },
    ],
  });

  const columns: [string, typeof header.location, [string, string][]][] = [
    [
      'Journeys',
      'FOOTER_ONE',
      [
        ['Our trips', '/trips'],
        ['Paro Tshechu', '/trips/tshechu'],
        ['Sacred valleys', '/trips/valleys'],
        ['Jomolhari trek', '/trips/jomolhari'],
        ['What you can do', '/activities'],
      ],
    ],
    [
      'Bhutan',
      'FOOTER_TWO',
      [
        ['Where we go', '/destinations'],
        ['Culture & traditions', '/culture'],
        ['Journal', '/journal'],
        ['Gallery', '/gallery'],
        ['When to come', '/#seasons'],
      ],
    ],
    [
      'Practical',
      'FOOTER_THREE',
      [
        ['Enquiry form', '/contact'],
        ['Travellers’ information', '/travellers-information'],
        ['About Lotus Peak', '/about'],
        ['Terms & conditions', '/terms'],
      ],
    ],
  ];

  for (const [name, location, links] of columns) {
    const menu = await db.menu.create({ data: { name, location } });
    await db.menuItem.createMany({
      data: links.map(([label, href], index) => ({
        menuId: menu.id,
        label,
        href,
        sortOrder: index + 1,
      })),
    });
  }

  console.log('  navigation   4 menus');
}
