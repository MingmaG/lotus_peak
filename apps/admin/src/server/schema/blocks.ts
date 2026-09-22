import { z } from 'zod';

import { richTextSchema } from './rich-text';

/**
 * What a `Json` column actually holds.
 *
 * One shape lives in a Json column — a page's sections — and it is a **stored**
 * shape, not the wire shape in `@lotuspeak/api-contracts`. The difference is
 * one field and it is the whole point:
 *
 * ```
 *   stored    { kind: 'figure', mediaId: 'abc', caption: '…' }
 *   on the    { kind: 'figure', image: { id, url, alt, width, height, … } }
 *   wire
 * ```
 *
 * A stored section references a photograph; a sent one carries it. If the
 * column held the serialised image, correcting one piece of alt text would
 * mean finding and rewriting every page that used the photograph — and missing
 * one would leave two descriptions of the same picture on the same site.
 * `public-site.ts` resolves the id on the way out.
 *
 * Everything here is parsed on write **and** on read. A Json column has no
 * shape as far as Postgres is concerned, so the only thing standing between a
 * bad migration and a page rendering `undefined` is this file.
 *
 * The journal body used to be here too, as a second union. It is one rich-text
 * `String` now, guarded by `./rich-text.ts` on this side and by the website's
 * allowlist on the other — a page's sections are furniture that moves around,
 * and a journal entry is prose, which is not the same thing and was never well
 * served by being modelled as a list of boxes.
 */

/* -------------------------------------------------------------------------- */
/*  Pages                                                                      */
/* -------------------------------------------------------------------------- */

const siteIcon = z
  .enum(['dzong', 'chorten', 'stupa', 'monastery', 'pavilion', 'dzong-long', 'buddha'])
  .nullable()
  .default(null);

export const storedPageSectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('prose'),
    eyebrow: z.string().max(80).nullable().default(null),
    title: z.string().max(200).nullable().default(null),
    body: richTextSchema,
    /**
     * The fragment this band answers to: `#money`.
     *
     * Its own field rather than derived from the title, because a fragment is
     * a URL. Somebody has bookmarked `/travellers-information#money` and
     * somebody else has linked to it from an email; deriving it from the title
     * means renaming "Money" to "Money and banking" silently breaks both, with
     * no redirect possible — a fragment never reaches the server.
     *
     * Null falls back to a slug of the title, which is right for a new band
     * nobody has linked to yet.
     */
    anchor: z.string().max(80).nullable().default(null),
  }),
  z.object({
    kind: z.literal('points'),
    eyebrow: z.string().max(80).nullable().default(null),
    title: z.string().max(200).nullable().default(null),
    lead: z.string().max(600).nullable().default(null),
    points: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          body: z.string().max(2_000),
          icon: siteIcon,
        }),
      )
      .min(1),
  }),
  z.object({
    kind: z.literal('facts'),
    title: z.string().max(200).nullable().default(null),
    rows: z.array(z.tuple([z.string().max(120), z.string().max(400)])).min(1),
  }),
  z.object({
    kind: z.literal('faq'),
    title: z.string().max(200).nullable().default(null),
    items: z
      .array(
        z.object({
          question: z.string().min(1).max(300),
          answer: z.string().min(1).max(4_000),
        }),
      )
      .min(1),
  }),
  z.object({
    kind: z.literal('figure'),
    mediaId: z.string().min(1),
    caption: z.string().max(400).nullable().default(null),
    width: z.enum(['full', 'inset']).default('inset'),
  }),
  z.object({
    kind: z.literal('gallery'),
    title: z.string().max(200).nullable().default(null),
    items: z
      .array(
        z.object({
          mediaId: z.string().min(1),
          ratio: z.string().max(12).nullable().default(null),
          width: z.string().max(4).nullable().default(null),
        }),
      )
      .min(1),
  }),
  z.object({
    kind: z.literal('reflections'),
    title: z.string().max(200).nullable().default(null),
    /* Empty means "the featured ones", which is what the design's bands do. */
    reflectionIds: z.array(z.string()).default([]),
  }),
  z.object({
    kind: z.literal('trips'),
    title: z.string().max(200).nullable().default(null),
    lead: z.string().max(600).nullable().default(null),
    /* Empty means the current catalogue, in its own order. */
    tripSlugs: z.array(z.string()).default([]),
  }),
  z.object({
    kind: z.literal('cta'),
    title: z.string().min(1).max(200),
    lead: z.string().max(600).nullable().default(null),
    label: z.string().min(1).max(60),
    href: z.string().min(1).max(500),
    band: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('people'),
    title: z.string().max(200).nullable().default(null),
    lead: z.string().max(600).nullable().default(null),
    personIds: z.array(z.string()).default([]),
  }),
]);

export type StoredPageSection = z.infer<typeof storedPageSectionSchema>;

export const storedPageSectionsSchema = z.array(storedPageSectionSchema);

/**
 * Reads a Json column, tolerating a row that predates a schema change.
 *
 * A section list that does not parse renders as *nothing* rather than
 * throwing. The alternative is one malformed section taking down a published
 * page, which is a far worse failure than one absent band — and the log line
 * names the row so somebody can go and look.
 */
export function parsePageSections(value: unknown, label: string): StoredPageSection[] {
  const result = storedPageSectionsSchema.safeParse(value);
  if (result.success) return result.data;
  console.error(`[content] ${label}: the sections did not parse`, result.error.issues);
  return [];
}

/** Every media id a section list refers to, for one batched fetch. */
export function mediaIdsIn(sections: StoredPageSection[]): string[] {
  const ids = new Set<string>();
  for (const section of sections) {
    if (section.kind === 'figure') ids.add(section.mediaId);
    if (section.kind === 'gallery') for (const item of section.items) ids.add(item.mediaId);
  }
  return [...ids];
}

/* -------------------------------------------------------------------------- */
/*  Journeys                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The figures under a journey's title, where the fixed five are not the story.
 *
 * Duration, nights, high point, difficulty and price are columns, because every
 * journey has them and the design draws them in a fixed row. This is the sixth
 * and the seventh — "11 days walking", "SDF included" — and it is Json for the
 * same reason the others are columns: there is no fixed set of them, and a
 * table would be a join on every journey read for a list that is usually empty.
 */
export const tripStatSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(60),
  note: z.string().max(200).nullable().default(null),
});

export const tripStatsSchema = z.array(tripStatSchema).max(8);

export type TripStat = z.infer<typeof tripStatSchema>;

/**
 * A journey's walking profile, as the chart reads it.
 *
 * `day` is the day number the itinerary shows, not an index — a rest day
 * consumes a number, and a profile whose days disagree with the itinerary's is
 * worse than no profile.
 */
export const elevationPointSchema = z.object({
  day: z.number().int().min(0).max(60),
  label: z.string().min(1).max(80),
  metres: z.number().int().min(-500).max(9000),
});

export const elevationProfileSchema = z.array(elevationPointSchema).max(60);

export type ElevationPoint = z.infer<typeof elevationPointSchema>;

export function parseTripStats(value: unknown, label: string): TripStat[] {
  const result = tripStatsSchema.safeParse(value);
  if (result.success) return result.data;
  console.error(`[content] ${label}: the stats did not parse`, result.error.issues);
  return [];
}

export function parseElevationProfile(value: unknown, label: string): ElevationPoint[] {
  const result = elevationProfileSchema.safeParse(value);
  if (result.success) return result.data;
  console.error(`[content] ${label}: the elevation profile did not parse`, result.error.issues);
  return [];
}
