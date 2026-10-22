import 'server-only';

import { z } from 'zod';

import { db } from '@/lib/db';
import { recordActivity, type ActivityInput } from '@/server/services/activity';
import { revalidateFor } from '@/server/services/revalidate';

import type { Actor } from '../context';
import { McpToolError } from '../errors';

/**
 * What every tool module needs and none should write twice.
 */

/**
 * The panel's own activity log, for a write an AI made.
 *
 * Under the name of the person whose token it was, because it was their
 * permission that allowed it, with the client named where the browser would
 * be. AI clients → Activity says what the model asked for; this says what changed,
 * on the screen the office already reads.
 */
export function recordAiActivity(
  actor: Actor,
  input: Omit<ActivityInput, 'userId' | 'ipAddress' | 'userAgent'>,
): void {
  void recordActivity({
    ...input,
    userId: actor.id,
    ipAddress: actor.ip,
    userAgent: `${actor.clientLabel} (AI client, via MCP)`,
  }).catch((error) => {
    console.error('[mcp] could not record activity', input.entity, error);
  });
}

/**
 * Tells the website, and never fails the write.
 *
 * The same rule every route follows: the row is written, the push is a
 * courtesy, and a website that is restarting costs staleness until the hourly
 * refresh rather than an error reported for a change that did happen.
 */
export function pushToSite(entity: string, paths: string[] = []): void {
  void revalidateFor(entity, paths).catch(() => undefined);
}

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(25)
  .describe('How many to return, at most 100.');

export const searchSchema = z
  .string()
  .max(200)
  .optional()
  .describe('Words to look for in the title, slug or summary.');

export const statusFilter = z
  .enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'])
  .optional()
  .describe('Only rows in this state.');

/**
 * Refuses a media id that names nothing.
 *
 * Every image field takes a library id, never a URL, so the site serves the
 * company's photographs from its own store. An id that resolves to nothing
 * would otherwise surface as a foreign-key failure on the whole save, which
 * does not say which of six fields was wrong.
 */
export async function assertMediaExists(ids: (string | null | undefined)[]): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return;
  const found = await db.media.findMany({
    where: { id: { in: wanted }, deletedAt: null },
    select: { id: true },
  });
  const known = new Set(found.map((row) => row.id));
  const missing = wanted.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new McpToolError(
      'VALIDATION_ERROR',
      `No photograph in the library has the id ${missing.join(', ')}. Use media_search to ` +
        'find one, or media_upload to add it — image fields take a library id, never a URL.',
      { missingMediaIds: missing },
    );
  }
}

/** A photograph as a tool reads it: enough to choose, not to render. */
export function mediaSummary(
  media: {
    id: string;
    filename: string;
    alt: string;
    isDecorative: boolean;
    width: number | null;
    height: number | null;
  } | null,
) {
  if (!media) return null;
  return {
    id: media.id,
    filename: media.filename,
    alt: media.alt,
    needsAlt: !media.isDecorative && media.alt.trim().length === 0,
    width: media.width,
    height: media.height,
  };
}

/** The SEO columns every content table shares, as a tool reads them. */
export function seoSummary(row: {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageId: string | null;
  keywords: string[];
  focusKeyword: string | null;
}) {
  return {
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    canonicalUrl: row.canonicalUrl,
    noIndex: row.noIndex,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImageId: row.ogImageId,
    keywords: row.keywords,
    focusKeyword: row.focusKeyword,
  };
}
