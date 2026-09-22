import { z } from 'zod';

import { richTextSchema, richTextToPlainText } from '@/server/schema/rich-text';
import { seoSchema, statusSchema } from './trip';

/**
 * A journal entry.
 *
 * The body is one rich-text document. It was an array of typed blocks,
 * validated by the same Zod union that guarded the column, and the argument
 * for that was a good one: an invalid body was a 422 with a field path in it
 * rather than a page that rendered half.
 *
 * What it could not do was let somebody write. Every sentence needed a box
 * chosen for it first, a photograph could not sit inside a paragraph, and a
 * table was two columns or nothing. Meanwhile every other long-form field on
 * this site — a journey's overview, an itinerary day, a page band — was one
 * HTML string written in the full editor, and had been for months.
 *
 * The guarantee has not gone; it has moved. `apps/web/src/lib/rich-text.ts`
 * rebuilds a body from an allowlist of the fourteen elements an article needs,
 * dropping everything it does not recognise, and it does that for this field
 * and for the eleven that were already HTML. That is a better place for it:
 * one implementation, checked on the way *out*, rather than a union that only
 * ever described what one editor happened to emit.
 */
export const postSchema = z.object({
  title: z.string().min(1, 'Give the entry a title.').max(200),
  slug: z.string().max(140).optional(),
  standfirst: z.string().max(600).default(''),
  /** Which shelf. Where it is about is `destinationIds`, not this. */
  category: z.enum(['JOURNEYS', 'TRAVEL_GUIDES', 'EXPERIENCES', 'STORIES']).default('STORIES'),
  body: richTextSchema.default(''),
  heroId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  tags: z.array(z.string().max(60)).max(20).default([]),
  relatedTripIds: z.array(z.string()).max(12).default([]),
  /** The places it is about. A valley or a place inside one. */
  destinationIds: z.array(z.string()).max(12).default([]),
  /** The culture it explains. */
  cultureIds: z.array(z.string()).max(12).default([]),
  featured: z.boolean().default(false),
  status: statusSchema.default('DRAFT'),
  publishedAt: z.string().datetime().nullable().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  seo: seoSchema.optional(),
});

export type PostInput = z.infer<typeof postSchema>;
export const postPatchSchema = postSchema.partial();
export type PostPatch = z.infer<typeof postPatchSchema>;

/**
 * Minutes, at 200 words a minute.
 *
 * Computed on save and stored, so the admin panel and the website print the
 * same number. Two implementations of "how long is this to read" is two
 * numbers that differ by one on the entry somebody checks.
 */
export function readingMinutes(body: string, standfirst: string): number {
  const words = countWords(standfirst) + countWords(body);
  return Math.max(1, Math.round(words / 200));
}

/** Words, with the markup taken out. */
function countWords(text: string): number {
  return richTextToPlainText(text).split(/\s+/).filter(Boolean).length;
}
