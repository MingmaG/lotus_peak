import type { JournalCategory as DbJournalCategory, SiteIcon as DbSiteIcon } from '@prisma/client';
import type { JournalCategory, SiteIconName } from '@lotuspeak/api-contracts';

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

/**
 * The database's silhouette and the one the design system draws.
 *
 * Both directions and both total, so a drawing added to one side alone is a
 * compile error. It has to be: `SiteIcon` renders a mask of
 * `icons/<name>.png`, and a name the design system does not have draws
 * nothing at all — an empty square that reads as a styling problem rather than
 * a missing mapping. Three services used to keep their own copy of this map
 * and the website's fixture disagreed with all of them about Paro.
 */
export const ICON_TO_WIRE: Record<DbSiteIcon, SiteIconName> = {
  DZONG: 'dzong',
  CHORTEN: 'chorten',
  STUPA: 'stupa',
  MONASTERY: 'monastery',
  PAVILION: 'pavilion',
  DZONG_LONG: 'dzong-long',
  BUDDHA: 'buddha',
  TAKTSANG: 'taktsang',
  PUNAKHA: 'punakha',
  JAKAR: 'jakar',
  TRONGSA: 'trongsa',
  MONGAR: 'mongar',
  PEMAGATSHEL: 'pemagatshel',
  TRASHIGANG: 'trashigang',
  GASA: 'gasa',
};

export const ICON_FROM_WIRE: Record<SiteIconName, DbSiteIcon> = {
  dzong: 'DZONG',
  chorten: 'CHORTEN',
  stupa: 'STUPA',
  monastery: 'MONASTERY',
  pavilion: 'PAVILION',
  'dzong-long': 'DZONG_LONG',
  buddha: 'BUDDHA',
  taktsang: 'TAKTSANG',
  punakha: 'PUNAKHA',
  jakar: 'JAKAR',
  trongsa: 'TRONGSA',
  mongar: 'MONGAR',
  pemagatshel: 'PEMAGATSHEL',
  trashigang: 'TRASHIGANG',
  gasa: 'GASA',
};
