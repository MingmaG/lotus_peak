import 'server-only';

import { db } from '@/lib/db';
import { parsePageSections } from '@/server/schema/blocks';
import { emptySeo, toPicked } from './trip-form';
import type { PageFormData } from '@/components/content/page-editor';
import type { PageSection } from '@/components/content/section-editor';
import type { PickedMedia } from '@/components/media/media-picker';

const MEDIA = { include: { renditions: { where: { format: 'webp' as const } } } };

export async function pageFormData(id: string): Promise<PageFormData | null> {
  const page = await db.page.findUnique({
    where: { id },
    include: { hero: MEDIA, ogImage: MEDIA },
  });
  if (!page) return null;

  const stored = parsePageSections(page.sections, `page:${page.path}`);

  /* Every photograph the bands refer to, in one query. */
  const mediaIds = new Set<string>();
  for (const section of stored) {
    if (section.kind === 'figure') mediaIds.add(section.mediaId);
    if (section.kind === 'gallery') for (const item of section.items) mediaIds.add(item.mediaId);
  }

  const media = mediaIds.size
    ? await db.media.findMany({ where: { id: { in: [...mediaIds] } }, include: MEDIA.include })
    : [];
  const byId = new Map<string, PickedMedia>();
  for (const row of media) {
    const picked = toPicked(row);
    if (picked) byId.set(row.id, picked);
  }

  const sections: PageSection[] = [];
  for (const section of stored) {
    const key = crypto.randomUUID();

    if (section.kind === 'figure') {
      const picked = byId.get(section.mediaId);
      /* A band whose photograph has been deleted is dropped rather than shown
         as an empty picker — the same rule the public API follows. */
      if (!picked) continue;
      sections.push({ key, kind: 'figure', media: picked, caption: section.caption, width: section.width });
      continue;
    }

    if (section.kind === 'gallery') {
      const items = section.items
        .map((item) => {
          const picked = byId.get(item.mediaId);
          return picked ? { media: picked, ratio: item.ratio, width: item.width } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      sections.push({ key, kind: 'gallery', title: section.title, items });
      continue;
    }

    sections.push({ key, ...section } as PageSection);
  }

  return {
    id: page.id,
    slug: page.slug,
    path: page.path,
    title: page.title,
    eyebrow: page.eyebrow ?? '',
    lead: page.lead ?? '',
    note: page.note ?? '',
    sections,
    hero: toPicked(page.hero),
    ogImage: toPicked(page.ogImage),
    isSystem: page.isSystem,
    showInSitemap: page.showInSitemap,
    status: page.status,
    seo: {
      metaTitle: page.metaTitle,
      schemaJson: page.schemaJson ?? null,
      metaDescription: page.metaDescription,
      canonicalUrl: page.canonicalUrl,
      noIndex: page.noIndex,
      noFollow: page.noFollow,
      ogTitle: page.ogTitle,
      ogDescription: page.ogDescription,
      ogImageId: page.ogImageId,
      twitterCard: page.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
      keywords: page.keywords,
      focusKeyword: page.focusKeyword,
      sitemapPriority: page.sitemapPriority,
      sitemapChangeFreq: page.sitemapChangeFreq as never,
    },
  };
}

export function emptyPageForm(): PageFormData {
  return {
    id: null,
    slug: '',
    path: '',
    title: '',
    eyebrow: '',
    lead: '',
    note: '',
    sections: [],
    hero: null,
    ogImage: null,
    isSystem: false,
    showInSitemap: true,
    status: 'DRAFT',
    seo: { ...emptySeo(), sitemapPriority: 0.5, sitemapChangeFreq: 'monthly' },
  };
}
