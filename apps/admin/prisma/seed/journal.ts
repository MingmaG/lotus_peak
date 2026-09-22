import { db } from '@/lib/db';

import { blocksToHtml, readingMinutes, type Block } from './blocks';
import type { ImageMap } from './media';
import posts from '../seed-data/posts.json';

/**
 * The journal: dated editorial on its four shelves.
 *
 * Each entry names, by slug, the places it is about, the culture it explains
 * and the journeys it mentions. Those links are written here, so an entry
 * lands on its places' pages and its shelf the moment it is seeded. A slug
 * that matches nothing is reported and skipped rather than failing the run.
 *
 * The five entries lotuspeak.org shipped with were places written up as
 * entries; they live under Where we go (see `seed-data/destinations.json`).
 */

interface PostJson {
  slug: string;
  title: string;
  standfirst: string;
  date: string;
  category?: 'JOURNEYS' | 'TRAVEL_GUIDES' | 'EXPERIENCES' | 'STORIES';
  heroImage: string;
  order: number;
  tags?: string[];
  destinations?: string[];
  culture?: string[];
  trips?: string[];
  body: Block[];
}

/** Slugs → ids, in the order given, reporting the ones that match nothing. */
async function idsFor(
  kind: 'destination' | 'culture' | 'trip',
  slugs: string[] | undefined,
  owner: string,
): Promise<string[]> {
  if (!slugs?.length) return [];
  const rows =
    kind === 'destination'
      ? await db.destination.findMany({ where: { slug: { in: slugs }, deletedAt: null }, select: { id: true, slug: true } })
      : kind === 'culture'
        ? await db.cultureArticle.findMany({ where: { slug: { in: slugs }, deletedAt: null }, select: { id: true, slug: true } })
        : await db.trip.findMany({ where: { slug: { in: slugs }, deletedAt: null }, select: { id: true, slug: true } });
  const bySlug = new Map(rows.map((row) => [row.slug, row.id]));
  const missing = slugs.filter((slug) => !bySlug.has(slug));
  if (missing.length) console.warn(`    ${owner}: no ${kind} called ${missing.join(', ')}`);
  return slugs.map((slug) => bySlug.get(slug)).filter((id): id is string => Boolean(id));
}

export async function seedJournal(images: ImageMap, authorId: string | null): Promise<void> {
  let droppedImages = 0;

  for (const post of posts as PostJson[]) {
    const { html: body, dropped } = blocksToHtml(post.body, images, post.slug);
    droppedImages += dropped;

    const base = {
      title: post.title,
      standfirst: post.standfirst,
      category: post.category ?? 'STORIES',
      body,
      readingMinutes: readingMinutes(body, post.standfirst),
      heroId: images.get(post.heroImage) ?? null,
      authorId,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(post.date),
      sortOrder: post.order,
      /* Null, so the search result follows the standfirst. */
      metaDescription: null,
    };

    const [destinationIds, cultureIds, tripIds] = await Promise.all([
      idsFor('destination', post.destinations, post.slug),
      idsFor('culture', post.culture, post.slug),
      idsFor('trip', post.trips, post.slug),
    ]);

    const links = {
      tags: post.tags ?? [],
      destinations: {
        deleteMany: {},
        create: destinationIds.map((destinationId, index) => ({ destinationId, sortOrder: index })),
      },
      culture: {
        deleteMany: {},
        create: cultureIds.map((cultureId, index) => ({ cultureId, sortOrder: index })),
      },
      tripLinks: {
        deleteMany: {},
        create: tripIds.map((tripId, index) => ({ tripId, sortOrder: index })),
      },
    };

    await db.post.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        ...base,
        tags: links.tags,
        destinations: { create: links.destinations.create },
        culture: { create: links.culture.create },
        tripLinks: { create: links.tripLinks.create },
      },
      /* A re-seed brings back an entry that was moved out of the journal
         only if the seed data still lists it, which it no longer does. */
      update: { ...base, ...links, deletedAt: null },
    });
  }

  console.log(
    `  journal      ${posts.length}${droppedImages ? ` (${droppedImages} photograph(s) dropped)` : ''}`,
  );
}
