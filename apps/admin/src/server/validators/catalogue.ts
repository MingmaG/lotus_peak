import { z } from 'zod';

import { richTextSchema } from '@/server/schema/rich-text';
import { seoSchema, statusSchema } from './trip';

/**
 * The smaller content types.
 *
 * Destinations, activities, seasons, culture articles, gallery images,
 * reflections and people. They share a shape — a title, a body, a photograph,
 * an order and a status — and they are *not* abstracted into one schema,
 * because the differences are the interesting part: a season is keyed by an
 * enum and has no slug, a gallery image has a caption but no title, and a
 * reflection has neither and must never grow a rating.
 *
 * Seven small schemas that say what each thing is beats one clever one that
 * says what they have in common.
 */

const icon = z.enum([
  'DZONG',
  'CHORTEN',
  'STUPA',
  'MONASTERY',
  'PAVILION',
  'DZONG_LONG',
  'BUDDHA',
]);

/**
 * A valley or a place.
 *
 * `parentId` null is a valley; a place names its valley. The body is one
 * rich-text document, the same editor and the same allowlist as a journal
 * entry — which is what "one editor" means in practice: nobody has to learn a
 * second way of writing a page.
 */
export const destinationSchema = z.object({
  slug: z.string().max(140).optional(),
  name: z.string().min(1, 'Give the place a name.').max(120),
  parentId: z.string().nullable().optional(),
  icon: icon.default('DZONG'),
  blurb: z.string().min(1, 'One line, for the card.').max(300),
  standfirst: z.string().max(600).default(''),
  body: richTextSchema.default(''),
  imageId: z.string().nullable().optional(),
  altitudeMetres: z.number().int().min(0).max(9_000).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: statusSchema.default('PUBLISHED'),
  seo: seoSchema.optional(),
});

export type DestinationInput = z.infer<typeof destinationSchema>;

export const activitySchema = z.object({
  slug: z.string().max(140).optional(),
  name: z.string().min(1, 'Give it a name.').max(120),
  blurb: z.string().min(1, 'One line.').max(300),
  icon: icon.default('PAVILION'),
  /**
   * What kind of thing this is.
   *
   * The site sells five journeys today and the office expects day tours,
   * retreats and courses. This is what lets those arrive without a second
   * table and a second set of screens.
   */
  kind: z
    .enum(['EXPERIENCE', 'DAY_TOUR', 'RETREAT', 'COURSE', 'TREK', 'FESTIVAL', 'OTHER'])
    .default('EXPERIENCE'),
  imageId: z.string().nullable().optional(),
  /** What the day actually consists of — three to five lines. */
  examples: z.array(z.string().max(400)).max(12).default([]),
  tripIds: z.array(z.string()).max(30).default([]),
  sortOrder: z.number().int().min(0).optional(),
  status: statusSchema.default('PUBLISHED'),
  seo: seoSchema.optional(),
});

/**
 * A season has no slug and no status.
 *
 * There are four, there will always be four, and the home page's band has four
 * panels. Deleting one would be deleting a quarter of the year.
 */
export const seasonSchema = z.object({
  name: z.string().min(1).max(60),
  monthsLabel: z.string().min(1, 'Which months. “Mar – May”.').max(60),
  headline: z.string().min(1).max(160),
  summary: z.string().min(1).max(600),
  detail: z.string().max(3_000).default(''),
  imageId: z.string().nullable().optional(),
});

/**
 * A culture piece.
 *
 * `destinationIds` is where to see it — dzongs and Punakha Dzong. The join is
 * edited here and only here, and shown on both pages: two editors for one
 * list is two people unticking each other's boxes.
 */
export const cultureSchema = z.object({
  slug: z.string().max(140).optional(),
  title: z.string().min(1, 'Give it a title.').max(160),
  standfirst: z.string().max(600).default(''),
  body: richTextSchema.default(''),
  icon: icon.default('CHORTEN'),
  imageId: z.string().nullable().optional(),
  destinationIds: z.array(z.string()).max(40).default([]),
  sortOrder: z.number().int().min(0).optional(),
  status: statusSchema.default('PUBLISHED'),
  seo: seoSchema.optional(),
});

export type CultureInput = z.infer<typeof cultureSchema>;

export const galleryImageSchema = z.object({
  mediaId: z.string().min(1),
  /**
   * The caption, which is not the alt text.
   *
   * "Cham, Paro Tshechu" is a caption; the description on the media row says
   * what a cham dancer looks like to somebody who cannot see the photograph.
   * Both exist, and conflating them loses one of them.
   */
  caption: z.string().min(1, 'Write the caption.').max(200),
  ratio: z.string().max(12).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: statusSchema.default('PUBLISHED'),
});

/**
 * A traveller's words.
 *
 * There is no rating field and there will not be one. The design forbids
 * stars, and a column nobody may render is a column somebody eventually will.
 */
export const reflectionSchema = z.object({
  quote: z.string().min(1, 'What did they say?').max(1_200),
  name: z.string().min(1, 'Who said it?').max(120),
  /** "Bumthang, 2026". Where and when, not a job title. */
  detail: z.string().max(160).nullable().optional(),
  tripId: z.string().nullable().optional(),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).optional(),
  status: statusSchema.default('PUBLISHED'),
});

export const personSchema = z.object({
  name: z.string().min(1, 'Give them a name.').max(120),
  role: z.string().min(1, 'What do they do?').max(120),
  bio: z.string().max(3_000).default(''),
  photoId: z.string().nullable().optional(),
  languages: z.array(z.string().max(60)).max(12).default([]),
  socials: z
    .array(
      z.object({
        platform: z.string().max(40),
        label: z.string().max(80),
        handle: z.string().max(120).nullable().optional(),
        url: z.string().url().max(400),
      }),
    )
    .max(8)
    .default([]),
  sortOrder: z.number().int().min(0).optional(),
  status: statusSchema.default('PUBLISHED'),
});

/** Reordering a whole list in one request, from a drag. */
export const reorderSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});
