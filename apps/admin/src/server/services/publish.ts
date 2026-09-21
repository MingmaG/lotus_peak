import 'server-only';

import type { ContentStatus } from '@prisma/client';

import { db } from '@/lib/db';
import { toSlug } from '@/lib/slug';
import { hasRichText } from '@/server/schema/rich-text';

/**
 * The rules that apply to publishing anything.
 *
 * Three of them, and each one exists because getting it wrong is expensive and
 * invisible for weeks.
 */

/* -------------------------------------------------------------------------- */
/*  Slugs                                                                      */
/* -------------------------------------------------------------------------- */

export interface SlugChange {
  slug: string;
  slugHistory: string[];
}

/**
 * Changes a slug without dropping the old URL.
 *
 * Renaming a journey is the single most expensive thing an editor can do to
 * this site's search position, and it is also a thing they must be able to do
 * — "Sacred valleys" becomes "Sacred valleys of Bhutan" and the slug should
 * follow. So the old slug is kept, a 301 is written, and the website serves it
 * forever.
 *
 * The redirect is marked `isAutomatic` so the Redirects screen shows it
 * differently and does not offer it for deletion: deleting it re-breaks the
 * link it was created to keep.
 */
export async function changeSlug(args: {
  entity: 'trip' | 'post' | 'page' | 'destination' | 'activity' | 'culture';
  currentSlug: string;
  nextSlug: string;
  currentHistory: string[];
  /** `/trips` for a journey, `/journal` for a post. `/` for a page. */
  pathPrefix: string;
}): Promise<SlugChange> {
  const next = toSlug(args.nextSlug);

  if (next === args.currentSlug) {
    return { slug: args.currentSlug, slugHistory: args.currentHistory };
  }

  const history = [...new Set([...args.currentHistory, args.currentSlug])].filter(
    (slug) => slug !== next,
  );

  const from = joinPath(args.pathPrefix, args.currentSlug);
  const to = joinPath(args.pathPrefix, next);

  await db.redirect.upsert({
    where: { source: from },
    create: {
      source: from,
      target: to,
      type: 'MOVED_301',
      isAutomatic: true,
      note: `Written automatically when the ${args.entity} slug changed.`,
    },
    update: { target: to, isActive: true },
  });

  /**
   * Redirects that pointed at the old URL are re-pointed at the new one.
   *
   * Without this, a journey renamed twice produces a chain — /a → /b → /c —
   * and a chain is a request a crawler follows at most a few times before
   * giving up, plus a redirect that eventually 404s if a link in it is
   * deleted. Rewriting them flat keeps every old URL one hop from the answer.
   */
  await db.redirect.updateMany({
    where: { target: from, source: { not: to } },
    data: { target: to },
  });

  return { slug: next, slugHistory: history };
}

function joinPath(prefix: string, slug: string): string {
  const clean = prefix.replace(/\/$/, '');
  return `${clean}/${slug}`;
}

/* -------------------------------------------------------------------------- */
/*  Status                                                                     */
/* -------------------------------------------------------------------------- */

export interface PublishFields {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledFor: Date | null;
}

/**
 * Works out `publishedAt` from a status change.
 *
 * `publishedAt` is the date the site prints and sorts by, so it must be set
 * once, on the first publish, and **not moved by a later edit**. Fixing a typo
 * in a journal entry from 2025 must not move it to the top of the journal.
 *
 * Unpublishing keeps it, so republishing restores the original date rather
 * than today's.
 */
export function resolvePublishing(args: {
  next: ContentStatus;
  currentStatus: ContentStatus;
  currentPublishedAt: Date | null;
  scheduledFor?: Date | null;
  /** An explicit date from the form, which wins over all of this. */
  explicitPublishedAt?: Date | null;
}): PublishFields {
  if (args.explicitPublishedAt) {
    return {
      status: args.next,
      publishedAt: args.explicitPublishedAt,
      scheduledFor: args.next === 'SCHEDULED' ? (args.scheduledFor ?? null) : null,
    };
  }

  if (args.next === 'PUBLISHED') {
    return {
      status: 'PUBLISHED',
      publishedAt: args.currentPublishedAt ?? new Date(),
      scheduledFor: null,
    };
  }

  if (args.next === 'SCHEDULED') {
    return {
      status: 'SCHEDULED',
      publishedAt: args.currentPublishedAt,
      scheduledFor: args.scheduledFor ?? null,
    };
  }

  return {
    status: args.next,
    publishedAt: args.currentPublishedAt,
    scheduledFor: null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Validation before publish                                                  */
/* -------------------------------------------------------------------------- */

export interface PublishProblem {
  field: string;
  message: string;
}

/**
 * What must be true before something may be published.
 *
 * Deliberately not the same as what must be true to *save*. An editor should
 * be able to save a half-written journey and come back to it; what they should
 * not be able to do is put a page on the website with no meta description and
 * a hero image nobody has described.
 *
 * The messages say why, in the office's own words, because "required field"
 * teaches nobody anything about why a photograph needs alt text.
 */
export async function problemsPublishingTrip(tripId: string): Promise<PublishProblem[]> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      hero: true,
      itinerary: { select: { id: true } },
      inclusions: { select: { id: true } },
    },
  });
  if (!trip) return [{ field: '_', message: 'That journey no longer exists.' }];

  const problems: PublishProblem[] = [];

  if (!trip.hero) {
    problems.push({
      field: 'heroId',
      message: 'Choose a photograph for the top of the page. Without one the hero renders as a grey band.',
    });
  } else if (!trip.hero.alt && !trip.hero.isDecorative) {
    problems.push({
      field: 'heroId',
      message:
        'The hero photograph has no description. Add one in the media library — it is what somebody using a screen reader hears instead of the picture.',
    });
  }

  if (trip.overview.length === 0) {
    problems.push({
      field: 'overview',
      message: 'Write at least one paragraph of overview. It is the first thing on the page under the hero.',
    });
  }

  if (trip.itinerary.length === 0) {
    problems.push({
      field: 'itinerary',
      message: 'Add the day-by-day. A journey page with no itinerary is the one thing every enquiry asks for.',
    });
  }

  if (trip.inclusions.length === 0) {
    problems.push({
      field: 'inclusions',
      message: 'Say what is and is not in the price.',
    });
  }

  if (trip.priceFromUsd <= 0) {
    problems.push({ field: 'priceFromUsd', message: 'Set the from price.' });
  }

  if (trip.regions.length === 0) {
    problems.push({
      field: 'regions',
      message: 'Add the region line — it is what the card under the title reads.',
    });
  }

  /**
   * A warning about the meta description, not a block.
   *
   * It falls back to the excerpt, which is a real sentence written to describe
   * the journey, so a missing one is not a broken page. Blocking on it would
   * teach the office to paste the excerpt in twice.
   */
  if (!trip.metaDescription && !trip.excerpt) {
    problems.push({
      field: 'metaDescription',
      message:
        'There is no meta description and no excerpt to fall back on, so a search result will show whatever it can scrape off the page.',
    });
  }

  return problems;
}

export async function problemsPublishingPost(postId: string): Promise<PublishProblem[]> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { hero: true },
  });
  if (!post) return [{ field: '_', message: 'That entry no longer exists.' }];

  const problems: PublishProblem[] = [];

  if (!post.standfirst.trim()) {
    problems.push({
      field: 'standfirst',
      message:
        'Write the standfirst. It is the sentence under the title, the default meta description, and the line marked as the one worth reading aloud.',
    });
  }

  if (!hasRichText(post.body)) {
    problems.push({ field: 'body', message: 'The entry has no body.' });
  }

  if (post.hero && !post.hero.alt && !post.hero.isDecorative) {
    problems.push({
      field: 'heroId',
      message: 'The hero photograph has no description.',
    });
  }

  return problems;
}
