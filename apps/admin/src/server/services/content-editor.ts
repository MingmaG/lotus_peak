import 'server-only';

import type { Media, MediaRendition, Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { richTextMediaIds, type FigureMedia } from '@/server/schema/rich-text';
import type { LinkOption } from '@/components/content/link-picker';
import type { SeoValue } from '@/components/content/seo-panel';

/**
 * What the three section editors — Where we go, Culture, Journal — share on
 * the server: the SEO columns as a form value, the photographs a body refers
 * to, and the list of things one section can link to in another.
 */

export const EDITOR_MEDIA = {
  include: { renditions: { where: { format: 'webp' as const } } },
} satisfies Prisma.MediaDefaultArgs;

interface SeoColumns {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageId: string | null;
  twitterCard: string;
  keywords: string[];
  focusKeyword: string | null;
  sitemapPriority: number;
  sitemapChangeFreq: string;
  schemaJson: Prisma.JsonValue | null;
}

export function seoFormValue(row: SeoColumns): SeoValue {
  return {
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    canonicalUrl: row.canonicalUrl,
    noIndex: row.noIndex,
    noFollow: row.noFollow,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageId: row.ogImageId,
    twitterCard: row.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
    keywords: row.keywords,
    focusKeyword: row.focusKeyword,
    sitemapPriority: row.sitemapPriority,
    sitemapChangeFreq: row.sitemapChangeFreq as SeoValue['sitemapChangeFreq'],
    schemaJson: row.schemaJson ?? null,
  };
}

/**
 * The photographs a body's figures name, as the *editor* needs them.
 *
 * Not the public API's version: that one points at the largest WebP rendition,
 * which is right for a published page and is a 1600 px file to draw inside a
 * text box. This takes the smallest, the way the media picker does, and it
 * accepts a row with no dimensions — the library has to show the photograph
 * nobody has measured, because that is the one somebody needs to fix.
 */
export async function editorFigureMedia(html: string): Promise<Map<string, FigureMedia>> {
  const ids = richTextMediaIds(html);
  if (ids.length === 0) return new Map();

  const rows = await db.media.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: EDITOR_MEDIA.include,
  });

  const map = new Map<string, FigureMedia>();
  for (const row of rows) {
    const smallest = [...row.renditions].sort((a, b) => a.width - b.width)[0];
    map.set(row.id, {
      url: storage.publicUrl(smallest?.storageKey ?? row.storageKey),
      alt: row.isDecorative ? '' : row.alt,
      width: row.width,
      height: row.height,
    });
  }
  return map;
}

/**
 * A photograph at a size worth looking at: the hero on a preview.
 *
 * The largest WebP up to 1600 px. The media picker's thumbnail is 320 px wide
 * and a preview drawn with it is a preview of a blurred website.
 */
export function previewImage(
  media: (Media & { renditions?: MediaRendition[] }) | null,
): { url: string; alt: string } | null {
  if (!media) return null;
  const best = [...(media.renditions ?? [])]
    .filter((r) => r.width <= 1600)
    .sort((a, b) => b.width - a.width)[0];
  return {
    url: storage.publicUrl(best?.storageKey ?? media.storageKey),
    alt: media.isDecorative ? '' : media.alt,
  };
}

export interface LinkOptions {
  /** Valleys in order, each followed by its places. */
  destinations: {
    id: string;
    name: string;
    parentId: string | null;
    status: string;
  }[];
  culture: { id: string; title: string; status: string }[];
}

/** Everything an entry or a culture piece can link to. */
export async function linkOptions(): Promise<LinkOptions> {
  const [destinations, culture] = await Promise.all([
    db.destination.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, parentId: true, status: true },
    }),
    db.cultureArticle.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, status: true },
    }),
  ]);

  const valleys = destinations.filter((d) => !d.parentId);
  const ordered = valleys.flatMap((valley) => [
    valley,
    ...destinations.filter((d) => d.parentId === valley.id),
  ]);
  /* A place whose valley was removed would otherwise vanish from the list
     while still linked — it goes at the end, where somebody will notice it. */
  const orphans = destinations.filter((d) => d.parentId && !valleys.some((v) => v.id === d.parentId));

  return { destinations: [...ordered, ...orphans], culture };
}

/** The company's site address, for "Open on the website". */
export async function siteUrl(): Promise<string> {
  const company = await db.companyProfile.findFirst({ select: { siteUrl: true } });
  return company?.siteUrl ?? 'https://lotuspeak.org';
}

/** Places as checkbox rows: each valley, then its places indented under it. */
export function placeOptions(options: LinkOptions): LinkOption[] {
  return options.destinations.map((d) => ({
    id: d.id,
    label: d.name,
    nested: d.parentId !== null,
    draft: d.status !== 'PUBLISHED',
  }));
}

export function cultureOptions(options: LinkOptions): LinkOption[] {
  return options.culture.map((c) => ({
    id: c.id,
    label: c.title,
    draft: c.status !== 'PUBLISHED',
  }));
}

/** Who an entry can be credited to. */
export function authorOptions() {
  return db.user.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/** The journeys an entry can mention. */
export function tripOptions() {
  return db.trip.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true },
  });
}
