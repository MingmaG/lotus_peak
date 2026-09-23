import { db } from '@/lib/db';

import { blocksToHtml, readingMinutes, type Block } from './blocks';
import type { ImageMap } from './media';
import posts from '../seed-data/posts.json';

/**
 * The journal.
 *
 * Empty in the seed data today, deliberately. The five entries lotuspeak.org
 * shipped with — Taktsang, Thimphu, Punakha Dzong, Bumthang, Trongsa Dzong —
 * were places written up as entries, and they live under Where we go now (see
 * `seed-data/destinations.json`). The journal is for dated editorial on its
 * four shelves, which the office writes; this stays so that an entry added to
 * `posts.json` is seeded the same way a place's body is.
 */

interface PostJson {
  slug: string;
  title: string;
  standfirst: string;
  date: string;
  category?: 'JOURNEYS' | 'TRAVEL_GUIDES' | 'EXPERIENCES' | 'STORIES';
  heroImage: string;
  order: number;
  body: Block[];
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
      metaDescription: post.standfirst,
    };

    await db.post.upsert({
      where: { slug: post.slug },
      create: { slug: post.slug, ...base },
      update: base,
    });
  }

  console.log(
    `  journal      ${posts.length}${droppedImages ? ` (${droppedImages} photograph(s) dropped)` : ''}`,
  );
}
