import { z } from 'zod';

/**
 * What a journey may be saved as.
 *
 * Saving and publishing are validated differently, on purpose. An editor must
 * be able to save a half-written journey and come back to it, so almost
 * everything here is optional or has a default; what must be true before it
 * reaches the website is in `server/services/publish.ts`, where the messages
 * explain *why* rather than saying "required".
 *
 * The one thing enforced on save is the shape: a `difficulty` outside the enum
 * or a `priceFromUsd` of `"4500"` is a value the site cannot render, and
 * accepting it means finding out on the published page.
 */

export const seoSchema = z.object({
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(400).nullable().optional(),
  canonicalUrl: z.string().max(500).nullable().optional(),
  noIndex: z.boolean().optional(),
  noFollow: z.boolean().optional(),
  ogTitle: z.string().max(200).nullable().optional(),
  ogDescription: z.string().max(400).nullable().optional(),
  ogImageId: z.string().nullable().optional(),
  twitterCard: z.enum(['summary', 'summary_large_image']).optional(),
  keywords: z.array(z.string().max(80)).max(30).optional(),
  focusKeyword: z.string().max(120).nullable().optional(),
  sitemapPriority: z.number().min(0).max(1).optional(),
  sitemapChangeFreq: z
    .enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])
    .optional(),
  schemaJson: z.unknown().nullable().optional(),
});

export type SeoInput = z.infer<typeof seoSchema>;

export const statusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);

const itineraryDaySchema = z.object({
  id: z.string().optional(),
  isRest: z.boolean().default(false),
  title: z.string().min(1, 'Give the day a title.').max(200),
  meta: z.string().max(200).nullable().optional(),
  body: z.string().max(4_000).nullable().optional(),
  mediaIds: z.array(z.string()).max(8).optional(),
});

const faqSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1, 'Write the question.').max(300),
  answer: z.string().min(1, 'Write the answer.').max(4_000),
  /**
   * The heading this question sits under, by the *client's* key.
   *
   * Not the row id: a group created in the same save has no id yet. The client
   * sends a stable key it made up, the service maps keys to rows once the
   * groups are written, and a question whose key names no group is simply
   * ungrouped — which is a correct answer, not an error to refuse a save over.
   */
  groupKey: z.string().max(60).nullable().optional(),
});

const faqGroupSchema = z.object({
  id: z.string().optional(),
  /** What the questions in it refer to. See `groupKey` above. */
  key: z.string().min(1).max(60),
  title: z.string().min(1, 'Give the group a heading.').max(200),
  blurb: z.string().max(600).nullable().optional(),
});

const pricingTierSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Name the tier — "Two travellers".').max(120),
  minPeople: z.number().int().min(1).max(60),
  maxPeople: z.number().int().min(1).max(60).nullable().optional(),
  priceUsd: z.number().int().min(0).max(1_000_000),
  wasPriceUsd: z.number().int().min(0).max(1_000_000).nullable().optional(),
  note: z.string().max(400).nullable().optional(),
});

const statSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(60),
  note: z.string().max(200).nullable().optional(),
});

const elevationPointSchema = z.object({
  day: z.number().int().min(0).max(60),
  label: z.string().min(1).max(80),
  metres: z.number().int().min(-500).max(9_000),
});

const galleryItemSchema = z.object({
  mediaId: z.string().min(1),
  ratio: z.string().max(12).nullable().optional(),
  width: z.string().max(8).nullable().optional(),
});

export const tripSchema = z.object({
  title: z.string().min(1, 'Give the journey a title.').max(200),
  slug: z.string().max(140).optional(),
  excerpt: z.string().max(600).default(''),
  type: z.enum(['MINDFULNESS', 'MEDITATION', 'FESTIVAL', 'TREKKING']),
  journeyLabel: z.string().max(120).default(''),

  durationDays: z.number().int().min(1).max(60),
  nights: z.number().int().min(0).max(60),
  highPointMetres: z.number().int().min(0).max(9_000),
  difficulty: z.enum(['GENTLE', 'MODERATE', 'DEMANDING']),
  priceFromUsd: z.number().int().min(0).max(1_000_000),
  priceCurrency: z.string().length(3).default('USD'),
  priceNote: z.string().max(600).nullable().optional(),
  pricingTiers: z.array(pricingTierSchema).max(12).default([]),
  seasonLabel: z.string().max(120).default(''),
  seasonKeys: z.array(z.enum(['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'])).default([]),
  paceNote: z.string().max(400).default(''),
  groupSizeMin: z.number().int().min(1).max(60).nullable().optional(),
  groupSizeMax: z.number().int().min(1).max(60).nullable().optional(),

  /**
   * The region line, as the card prints it.
   *
   * An array of names rather than the joined string, because the design joins
   * them with a middot and a thin space and an editor should not have to type
   * one. The site does the joining; this is the list.
   */
  regions: z.array(z.string().max(80)).max(20).default([]),

  overview: z.array(z.string().max(4_000)).max(20).default([]),
  highlights: z.array(z.string().max(400)).max(30).default([]),
  included: z.array(z.string().max(400)).max(40).default([]),
  excluded: z.array(z.string().max(400)).max(40).default([]),

  itinerary: z.array(itineraryDaySchema).max(60).default([]),
  faqs: z.array(faqSchema).max(60).default([]),
  faqGroups: z.array(faqGroupSchema).max(12).default([]),
  gallery: z.array(galleryItemSchema).max(60).default([]),
  stats: z.array(statSchema).max(8).default([]),
  elevationProfile: z.array(elevationPointSchema).max(60).default([]),

  heroId: z.string().nullable().optional(),
  routeMapId: z.string().nullable().optional(),
  videoUrl: z.string().max(500).nullable().optional(),
  destinationIds: z.array(z.string()).max(30).default([]),
  /** Destinations that offer this journey, in the order they offer it. */
  offeredByDestinationIds: z.array(z.string()).max(30).default([]),
  relatedTripIds: z.array(z.string()).max(12).default([]),

  featured: z.boolean().default(false),
  status: statusSchema.default('DRAFT'),
  scheduledFor: z.string().datetime().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).max(9_999).optional(),

  seo: seoSchema.optional(),
})
  .refine((value) => value.nights <= value.durationDays, {
    message: 'There cannot be more nights than days.',
    path: ['nights'],
  })
  .refine(
    (value) =>
      value.groupSizeMin == null ||
      value.groupSizeMax == null ||
      value.groupSizeMin <= value.groupSizeMax,
    { message: 'The smallest group cannot be larger than the largest.', path: ['groupSizeMin'] },
  );

export type TripInput = z.infer<typeof tripSchema>;

/** A partial save — the editor autosaves, and an autosave is not a full form. */
export const tripPatchSchema = tripSchema.innerType().innerType().partial().extend({
  seo: seoSchema.optional(),
});

export type TripPatch = z.infer<typeof tripPatchSchema>;
