import { z } from 'zod';

import { storedPostBlockSchema } from '@/server/schema/blocks';
import { seoSchema, statusSchema } from './trip';

/**
 * A journal entry.
 *
 * The body is validated by the same schema that guards the column, so a shape
 * the editor can produce and the site cannot render does not exist. That is
 * the whole value of the block union over a rich-text blob: an invalid body is
 * a 422 with a field path in it rather than a page that renders half.
 */
export const postSchema = z.object({
  title: z.string().min(1, 'Give the entry a title.').max(200),
  slug: z.string().max(140).optional(),
  standfirst: z.string().max(600).default(''),
  region: z.string().max(120).default(''),
  body: z.array(storedPostBlockSchema).max(200).default([]),
  heroId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  tags: z.array(z.string().max(60)).max(20).default([]),
  relatedTripIds: z.array(z.string()).max(12).default([]),
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
export function readingMinutes(body: PostInput['body'], standfirst: string): number {
  let words = standfirst.split(/\s+/).filter(Boolean).length;

  for (const block of body) {
    if (block.kind === 'text') words += countWords(block.body);
    if (block.kind === 'heading') words += countWords(block.text);
    if (block.kind === 'quote') words += countWords(block.text);
    if (block.kind === 'list') {
      words += block.items.reduce((sum, item) => sum + countWords(item), 0);
    }
    if (block.kind === 'facts') {
      words += block.rows.reduce((sum, [label, value]) => sum + countWords(`${label} ${value}`), 0);
    }
  }

  return Math.max(1, Math.round(words / 200));
}

/** Words, with the restricted inline HTML stripped first. */
function countWords(text: string): number {
  return text
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}
