import 'server-only';

import { createHmac } from 'node:crypto';
import type { RevalidateRequest, RevalidateTag } from '@lotuspeak/api-contracts';

import { env, revalidationConfigured } from '@/lib/env';

/**
 * Telling the website something changed.
 *
 * The website prerenders every page and tags every fetch. This posts the tags
 * a save touched; the website drops those cache entries and rebuilds those
 * pages on the next request. Roughly a second, and no deploy.
 *
 * ## The push cannot fail a save
 *
 * The row is written first and this is called afterwards, never awaited in a
 * way that can throw into the handler. A website that cannot be reached is a
 * log line and a warning on the dashboard — not an error on an editor's form.
 * Losing a push costs staleness until the hourly refresh, which is a far
 * better failure than refusing to save somebody's work because a second
 * service is down.
 *
 * ## Why it is signed
 *
 * `/api/revalidate` on the website drops cache entries, which is a cheap way
 * to make a site rebuild every page on every request. The HMAC is over the
 * body including its timestamp, so a captured request cannot be replayed a day
 * later to do it again.
 */

export interface RevalidateResult {
  ok: boolean;
  detail?: string;
}

export async function revalidate(
  tags: RevalidateTag[],
  paths: string[] = [],
): Promise<RevalidateResult> {
  if (!revalidationConfigured()) {
    return {
      ok: false,
      detail:
        'SITE_REVALIDATE_SECRET is not set, so the website was not told. It will pick the change up on its hourly refresh.',
    };
  }

  const payload: RevalidateRequest = {
    tags,
    paths,
    issuedAt: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', env.site.revalidateSecret)
    .update(body)
    .digest('hex');

  try {
    const response = await fetch(`${env.site.url}/api/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-lotuspeak-signature': signature,
      },
      body,
      /**
       * Five seconds.
       *
       * Long enough for a site on the same machine and short enough that a
       * hung website does not hold an editor's Save open. The record is
       * already written by the time this runs, so a timeout costs staleness
       * and nothing else.
       */
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return { ok: false, detail: `The website answered ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail:
        (error as Error).name === 'TimeoutError'
          ? 'The website did not answer within five seconds.'
          : `The website could not be reached at ${env.site.url}.`,
    };
  }
}

/**
 * The tags a change to one kind of thing touches.
 *
 * More than the obvious one, in every case, and that is the point of having it
 * in one place. Renaming a journey changes the journeys index, the home page,
 * the destination pages that link to it, the sitemap and `llms.txt` — and a
 * handler that remembered only `trips` would leave five of those stale for an
 * hour.
 */
export const TAGS_FOR: Record<string, RevalidateTag[]> = {
  /* `journal` because a journey's editor writes the same entry ↔ journey links
     the entry's own editor does, and an entry's page lists its journeys. */
  trip: ['trips', 'destinations', 'activities', 'journal', 'pages', 'discovery'],
  departure: ['trips'],
  /* The three sections link to each other — a place lists its culture and
     its journal entries, an entry names its places — so a change to any one
     of them touches the pages of the other two. */
  destination: ['destinations', 'culture', 'journal', 'trips', 'discovery'],
  activity: ['activities', 'trips', 'discovery'],
  season: ['seasons'],
  culture: ['culture', 'destinations', 'journal', 'discovery'],
  gallery: ['gallery'],
  reflection: ['reflections', 'pages'],
  post: ['journal', 'destinations', 'culture', 'discovery'],
  page: ['pages', 'discovery'],
  person: ['pages'],
  menu: ['navigation', 'site'],
  company: ['site', 'discovery'],
  redirect: ['redirects'],
  media: ['trips', 'destinations', 'activities', 'seasons', 'culture', 'gallery', 'journal', 'pages', 'site'],
  email: ['emails'],
};

/** Convenience for a handler: the tags for this entity, pushed. */
export function revalidateFor(
  entity: keyof typeof TAGS_FOR | string,
  paths: string[] = [],
): Promise<RevalidateResult> {
  return revalidate(TAGS_FOR[entity] ?? ['site'], paths);
}
