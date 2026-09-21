import { z } from 'zod';

/**
 * What a rich-text column holds, and the two things that are true of all of
 * them.
 *
 * Eleven columns on this schema are long-form prose written in the same editor
 * — a journey's overview, an itinerary day, a page band, a teacher's
 * biography, a journal entry. They are `String`, they hold HTML, and this file
 * is the only description of what that HTML is allowed to be on *this* side of
 * the wire. The website has its own, stricter description in
 * `apps/web/src/lib/rich-text.ts`, which rebuilds a body from an allowlist
 * before rendering it; the two are deliberately separate, because a panel that
 * trusts the website's sanitiser is a panel that has no opinion about what it
 * just saved.
 *
 * ## A photograph is referenced, never serialised
 *
 * `<figure data-media-id="clx…">` is the stored shape. The `<img>` inside it
 * carries a URL so the body is legible on its own, but that URL is *derived*:
 * {@link stripRichTextMedia} takes it out before a write and
 * `resolveRichTextMedia` puts a fresh one back on a read. The consequence is
 * the rule at the top of `schema.prisma` — re-cropping a photograph, moving
 * the media store to a CDN, or correcting one description reaches every body
 * that used it, without an UPDATE over the prose.
 *
 * A figure with no `data-media-id` is left exactly as it is. That is a body
 * written before this existed, or one pasted from elsewhere, and rewriting it
 * would lose the only URL it has.
 */

/**
 * The ceiling on one rich-text field.
 *
 * Generous — a long journal entry with five photographs and a table is perhaps
 * 30 kB — and it exists so that a runaway paste, or a client sending a
 * megabyte of markup, is a 422 rather than a row nothing can render.
 */
export const RICH_TEXT_MAX = 200_000;

export const richTextSchema = z.string().max(RICH_TEXT_MAX);

/* -------------------------------------------------------------------------- */
/*  Media references                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Every `data-media-id` in a body.
 *
 * A regex rather than a parse, and that is the right tool here: the question
 * is not "what does this document mean" but "which rows does it mention", and
 * a false positive costs one row in an `IN` clause that nothing then uses.
 */
const MEDIA_ID = /data-media-id="([^"]+)"/g;

export function richTextMediaIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  MEDIA_ID.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MEDIA_ID.exec(html)) !== null) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}

/** Every media id in a set of bodies, for one batched fetch. */
export function richTextMediaIdsIn(bodies: (string | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const body of bodies) for (const id of richTextMediaIds(body)) ids.add(id);
  return [...ids];
}

/** What a resolver needs to know about a photograph to fill a figure in. */
export interface FigureMedia {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

const FIGURE = /<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi;

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`, 'i').exec(tag);
  return match ? (match[1] ?? null) : null;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Fills a stored body's figures in from the media library.
 *
 * Called on the way **out** — into the public API, and into the editor's own
 * form data, which are the only two places a body is read. The `src` and the
 * dimensions always come from the row. The `alt` comes from the row *unless*
 * the figure carries one of its own, because the description of a photograph
 * genuinely depends on where it is used: the same picture of Taktsang is "the
 * monastery from the tea house" in one entry and "the last of the climb" in
 * another, and the library can only hold one of those.
 *
 * A figure whose photograph has been deleted keeps whatever `src` it had, and
 * renders as an ordinary image or as nothing. It is not dropped: losing a
 * paragraph of somebody's writing because a photograph was tidied away is a
 * worse failure than a gap.
 */
export function resolveRichTextMedia(
  html: string | null | undefined,
  media: Map<string, FigureMedia>,
): string {
  if (!html || !html.includes('data-media-id')) return html ?? '';

  FIGURE.lastIndex = 0;
  return html.replace(FIGURE, (whole, rawAttrs: string, inner: string) => {
    const id = attr(rawAttrs, 'data-media-id');
    if (!id) return whole;

    const row = media.get(id);
    if (!row) return whole;

    /* The figure's own description wins over the library's — see above. An
       empty `data-alt` is a decision too: it means decorative. */
    const override = attr(rawAttrs, 'data-alt');
    const alt = override === null ? row.alt : override;

    const title = attr(rawAttrs, 'data-title');
    const dimensions =
      row.width && row.height ? ` width="${row.width}" height="${row.height}"` : '';

    const img =
      `<img src="${escapeAttr(row.url)}" alt="${escapeAttr(alt)}"` +
      (title ? ` title="${escapeAttr(title)}"` : '') +
      `${dimensions}>`;

    /* Anything in the figure other than the image — nothing, at the moment — is
       kept, so a shape this function does not know about survives it. */
    const rest = inner.replace(/<img\b[^>]*>/gi, '');
    return `<figure${rawAttrs}>${img}${rest}</figure>`;
  });
}

/**
 * Takes the derived `src` back out before a body is stored.
 *
 * The editor round-trips the URL it was given, which would otherwise be
 * written back into the column — and a URL in the column is exactly the thing
 * that goes stale when the media store moves. Only a figure that names a media
 * id is stripped; one that does not has nothing else to identify it by.
 */
export function stripRichTextMedia(html: string | null | undefined): string {
  if (!html || !html.includes('data-media-id')) return html ?? '';

  FIGURE.lastIndex = 0;
  return html.replace(FIGURE, (whole, rawAttrs: string, inner: string) => {
    if (!attr(rawAttrs, 'data-media-id')) return whole;
    return `<figure${rawAttrs}>${inner.replace(/<img\b[^>]*>/gi, '')}</figure>`;
  });
}

/* -------------------------------------------------------------------------- */
/*  Reading a body without rendering it                                        */
/* -------------------------------------------------------------------------- */

/**
 * The words in a body, with the markup taken out.
 *
 * For the two things that have to measure prose rather than draw it: the
 * reading time printed on a journal entry, and the SEO panel's word count.
 * Block-level tags become a space so that `</p><p>` does not run the last word
 * of one paragraph into the first of the next and count them as one.
 */
export function richTextToPlainText(html: string | null | undefined): string {
  if (!html) return '';

  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    /* A figure's caption is the photograph's label, not prose — counting it
       towards a reading time makes an entry of photographs look like an essay. */
    .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether a body has anything in it once the markup is taken out. */
export function hasRichText(html: string | null | undefined): boolean {
  if (!html) return false;
  /* A figure is content even though `richTextToPlainText` drops its words — an
     entry that is one photograph is not an empty entry. */
  if (/<(figure|img|table|hr)\b/i.test(html)) return true;
  return richTextToPlainText(html).length > 0;
}
