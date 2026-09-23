import type { JournalCategory as DbJournalCategory } from '@prisma/client';
import type { JournalCategory } from '@lotuspeak/api-contracts';

/**
 * Where each of the three sections lives on the website.
 *
 * One module, because a place's URL is made of two slugs and three things
 * need to spell it identically: the public API that puts `path` on every
 * record, the redirect written when a slug changes, and the preview link. Two
 * spellings of `/destinations/paro/taktsang` is a preview that opens a 404.
 *
 * No `server-only`: the editors import these to show an address under the
 * title, and they are pure string functions.
 */

export function destinationPath(slug: string, parentSlug: string | null | undefined): string {
  return parentSlug ? `/destinations/${parentSlug}/${slug}` : `/destinations/${slug}`;
}

export function culturePath(slug: string): string {
  return `/culture/${slug}`;
}

export function postPath(slug: string): string {
  return `/journal/${slug}`;
}

/**
 * The database's enum and the wire's URL segment.
 *
 * Two spellings because each is right where it is: an enum value is
 * `TRAVEL_GUIDES` by Prisma's convention, and a URL segment is
 * `travel-guides` by the web's. The mapping is total in both directions, so
 * the compiler notices a fifth shelf added on only one side.
 */
export const CATEGORY_TO_WIRE: Record<DbJournalCategory, JournalCategory> = {
  JOURNEYS: 'journeys',
  TRAVEL_GUIDES: 'travel-guides',
  EXPERIENCES: 'experiences',
  STORIES: 'stories',
};

export const CATEGORY_FROM_WIRE: Record<JournalCategory, DbJournalCategory> = {
  journeys: 'JOURNEYS',
  'travel-guides': 'TRAVEL_GUIDES',
  experiences: 'EXPERIENCES',
  stories: 'STORIES',
};
