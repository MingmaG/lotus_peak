import { z } from 'zod';

/**
 * What a `Json` column actually holds.
 *
 * Two shapes live in Json columns — a journal body and a page's sections — and
 * both are **stored** shapes, not the wire shapes in
 * `@lotuspeak/api-contracts`. The difference is one field and it is the whole
 * point:
 *
 * ```
 *   stored    { kind: 'image', mediaId: 'abc', ratio: '3/4' }
 *   on the    { kind: 'image', image: { id, url, alt, width, height, … } }
 *   wire
 * ```
 *
 * A stored block references a photograph; a sent block carries it. If the
 * column held the serialised image, correcting one piece of alt text would
 * mean finding and rewriting every journal body and every page that used the
 * photograph — and missing one would leave two descriptions of the same
 * picture on the same site. `public-site.ts` resolves the id on the way out.
 *
 * Everything here is parsed on write **and** on read. A Json column has no
 * shape as far as Postgres is concerned, so the only thing standing between a
 * bad migration and a page rendering `undefined` is this file.
 */

/* -------------------------------------------------------------------------- */
/*  Journal                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Inline HTML inside a `text` block.
 *
 * Deliberately narrow. The editor's toolbar offers bold, italic, a link and
 * the two list types, and nothing else — no colour, no font size, no
 * alignment, because those are the design system's job and a pasted
 * `<h1 style="color:red">` is a design breach nobody sees until it is live.
 * This is not a sanitiser; it is the schema saying what the editor may
 * produce, and the sanitiser runs beside it.
 */
const richText = z.string().max(20_000);

export const storedPostBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), body: richText }),
  z.object({ kind: z.literal('heading'), text: z.string().min(1).max(200) }),
  z.object({
    kind: z.literal('list'),
    items: z.array(z.string().max(2_000)).min(1),
    ordered: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal('quote'),
    text: z.string().min(1).max(2_000),
    attribution: z.string().max(200).nullable().default(null),
  }),
  z.object({
    kind: z.literal('image'),
    mediaId: z.string().min(1),
    ratio: z.string().max(12).nullable().default(null),
  }),
  z.object({
    kind: z.literal('facts'),
    title: z.string().max(200),
    /* A tuple, so a row cannot arrive with one cell or three. */
    rows: z.array(z.tuple([z.string().max(120), z.string().max(400)])).min(1),
  }),
]);

export type StoredPostBlock = z.infer<typeof storedPostBlockSchema>;

export const storedPostBodySchema = z.array(storedPostBlockSchema);

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
    body: richText,
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
 * A body that does not parse renders as *nothing* rather than throwing. The
 * alternative is one malformed block taking down a published page, which is a
 * far worse failure than one absent paragraph — and the log line names the row
 * so somebody can go and look.
 */
export function parsePostBody(value: unknown, label: string): StoredPostBlock[] {
  const result = storedPostBodySchema.safeParse(value);
  if (result.success) return result.data;
  console.error(`[content] ${label}: the body did not parse`, result.error.issues);
  return [];
}

export function parsePageSections(value: unknown, label: string): StoredPageSection[] {
  const result = storedPageSectionsSchema.safeParse(value);
  if (result.success) return result.data;
  console.error(`[content] ${label}: the sections did not parse`, result.error.issues);
  return [];
}

/** Every media id a body or a section list refers to, for one batched fetch. */
export function mediaIdsIn(
  blocks: (StoredPostBlock | StoredPageSection)[],
): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.kind === 'image' || block.kind === 'figure') ids.add(block.mediaId);
    if (block.kind === 'gallery') for (const item of block.items) ids.add(item.mediaId);
  }
  return [...ids];
}
