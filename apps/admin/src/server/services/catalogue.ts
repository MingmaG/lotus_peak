import 'server-only';

import type { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { changeSlug, resolvePublishing } from './publish';
import type { SeoInput } from '@/server/validators/trip';

/**
 * The write half of the smaller content types.
 *
 * Three things they all need and none of them should repeat: a unique slug on
 * create, a 301 on a slug change, and `publishedAt` set once and never moved
 * by a later edit. Those are here; everything else is in the route, where the
 * differences between a destination and a reflection are visible.
 */

export type SlugEntity = 'destination' | 'activity' | 'culture';

const PATH_PREFIX: Record<SlugEntity, string> = {
  /**
   * A valley's page. A *place's* URL has its valley's slug in it as well, so
   * the destination route works its redirects out itself and does not come
   * through here — this is only right for a valley.
   */
  destination: '/destinations',
  culture: '/culture',
  activity: '/activities',
};

export async function nextSlug(
  entity: SlugEntity,
  desired: string,
): Promise<string> {
  const taken = await takenSlugs(entity);
  return uniqueSlug(desired, taken);
}

async function takenSlugs(entity: SlugEntity): Promise<string[]> {
  const rows =
    entity === 'destination'
      ? await db.destination.findMany({ select: { slug: true } })
      : entity === 'activity'
        ? await db.activity.findMany({ select: { slug: true } })
        : await db.cultureArticle.findMany({ select: { slug: true } });
  return rows.map((row) => row.slug);
}

export interface SlugResult {
  slug: string;
  slugHistory: string[];
}

/** A slug change on one of the anchor-page entities. */
export async function moveSlug(args: {
  entity: SlugEntity;
  currentSlug: string;
  currentHistory: string[];
  nextSlug: string;
}): Promise<SlugResult> {
  if (toSlug(args.nextSlug) === args.currentSlug) {
    return { slug: args.currentSlug, slugHistory: args.currentHistory };
  }
  return changeSlug({
    entity: args.entity,
    currentSlug: args.currentSlug,
    nextSlug: args.nextSlug,
    currentHistory: args.currentHistory,
    pathPrefix: PATH_PREFIX[args.entity],
  });
}

/** The publishing columns, worked out from a status change. */
export function publishing(args: {
  next: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | undefined;
  currentStatus: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  currentPublishedAt: Date | null;
}) {
  if (args.next === undefined) return {};
  const resolved = resolvePublishing({
    next: args.next,
    currentStatus: args.currentStatus,
    currentPublishedAt: args.currentPublishedAt,
  });
  return { status: resolved.status, publishedAt: resolved.publishedAt };
}

/**
 * The SEO columns, in the unchecked shape.
 *
 * `ogImageId` rather than `ogImage: { connect }`: Prisma's two update shapes
 * cannot be mixed, and every caller sets other foreign keys by id.
 */
export function seoColumns(seo: SeoInput | undefined) {
  if (!seo) return {};
  return {
    metaTitle: seo.metaTitle,
    metaDescription: seo.metaDescription,
    canonicalUrl: seo.canonicalUrl,
    noIndex: seo.noIndex,
    noFollow: seo.noFollow,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImageId: seo.ogImageId === undefined ? undefined : seo.ogImageId,
    twitterCard: seo.twitterCard,
    keywords: seo.keywords,
    focusKeyword: seo.focusKeyword,
    sitemapPriority: seo.sitemapPriority,
    sitemapChangeFreq: seo.sitemapChangeFreq,
    schemaJson: seo.schemaJson === undefined ? undefined : (seo.schemaJson as never),
  };
}

/**
 * Rewrites a list's order from an array of ids.
 *
 * One transaction and one `UPDATE` per row. A single statement with a `CASE`
 * would be faster and would also be raw SQL repeated per table; these lists
 * are six to thirty rows and are reordered by hand, so the loop costs
 * milliseconds nobody can perceive.
 *
 * Ids that are not in the list are left where they are, which means a
 * concurrent create cannot be silently pushed to position zero.
 */
export async function reorder(
  table: 'destination' | 'activity' | 'cultureArticle' | 'galleryImage' | 'reflection' | 'person' | 'trip',
  ids: string[],
): Promise<void> {
  await db.$transaction(
    ids.map((id, index) =>
      // @ts-expect-error — the delegate is chosen at runtime and every one of
      // these tables has `id` and `sortOrder`. Typing it properly would mean a
      // union of seven delegate types to express one UPDATE.
      db[table].update({ where: { id }, data: { sortOrder: index } }),
    ) as Prisma.PrismaPromise<unknown>[],
  );
}
