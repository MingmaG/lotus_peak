/**
 * What a stored image URL means.
 *
 * One parser for both apps, so the admin panel's preview and the website's
 * `<img>` resolve the same rendition of the same photograph. When these
 * disagree the symptom is subtle and expensive: an editor crops against a
 * 1600 px rendition, the site serves 800, and the focal point is half a face
 * off in production and correct in the preview.
 */

/**
 * The widths the library builds a rendition at.
 *
 * Chosen against the design's own breakpoints rather than a round-number
 * ladder. The site's container tops out at 1320 px and its full-bleed bands go
 * edge to edge, so 1600 covers a 1440 laptop and 2400 covers a 2× phone and a
 * 5K display; 400 is the masonry cell on a 360 px phone.
 */
export const RENDITION_WIDTHS = [400, 800, 1200, 1600, 2400] as const;

export type RenditionWidth = (typeof RENDITION_WIDTHS)[number];

/** The formats a rendition is stored in, best first. */
export const RENDITION_FORMATS = ['avif', 'webp', 'jpeg'] as const;

export type RenditionFormat = (typeof RENDITION_FORMATS)[number];

export interface StoredImage {
  url: string;
  width: number;
  height: number;
  focal?: [number, number];
}

/**
 * A rendition key: `media/<id>/<width>.<format>`.
 *
 * The id is a directory rather than a filename prefix so a photograph and all
 * its renditions delete with one prefix delete, and so replacing the file
 * behind a photograph — which the office does, and which must keep every
 * reference to it working — is a write into the same directory.
 */
export function renditionKey(
  id: string,
  width: RenditionWidth,
  format: RenditionFormat,
): string {
  return `media/${id}/${width}.${format}`;
}

export function originalKey(id: string, extension: string): string {
  return `media/${id}/original.${extension.replace(/^\./, '')}`;
}

/**
 * The widths worth building for a source of this size.
 *
 * Never upscales. A 900 px source gets 400 and 800 and stops, because a 1600 px
 * rendition of it is a bigger file carrying no more detail — and `srcset` would
 * dutifully choose it on a retina phone.
 */
export function widthsFor(sourceWidth: number): RenditionWidth[] {
  const usable = RENDITION_WIDTHS.filter((w) => w <= sourceWidth);
  // A source narrower than the smallest rendition still needs one entry, or
  // `srcset` is empty and the browser falls back to the original.
  return usable.length > 0 ? usable : [RENDITION_WIDTHS[0]];
}

/**
 * `srcset` for a stored image.
 *
 * `base` is the public origin of the media store — the MinIO bucket in
 * development, Supabase or a CDN in production — so moving the store is a
 * config change and not a migration of every URL in the database.
 */
export function srcSet(
  base: string,
  id: string,
  sourceWidth: number,
  format: RenditionFormat = 'webp',
): string {
  const origin = base.replace(/\/$/, '');
  return widthsFor(sourceWidth)
    .map((w) => `${origin}/${renditionKey(id, w, format)} ${w}w`)
    .join(', ');
}

/**
 * `object-position` from a focal point.
 *
 * The design crops hard: parallax bands, masked strips, 3/4 masonry cells. A
 * face centred in the source is not a face centred in a 16/9 crop of it, so
 * every media row carries where to hold the crop and this turns it into CSS.
 */
export function objectPosition(focal: [number, number] | undefined): string {
  const [x, y] = focal ?? [0.5, 0.5];
  return `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
}

/**
 * `sizes` for an image that fills a fraction of the container.
 *
 * Written as a helper because getting it wrong is invisible in development —
 * a wrong `sizes` still renders, it just downloads a 2400 px file for a
 * 400 px slot, and nobody notices until someone opens the site on mobile data.
 */
export function sizesFor(
  fraction: 'full-bleed' | 'container' | 'half' | 'third' | 'quarter',
): string {
  switch (fraction) {
    case 'full-bleed':
      return '100vw';
    case 'container':
      return '(max-width: 1320px) 100vw, 1320px';
    case 'half':
      return '(max-width: 768px) 100vw, (max-width: 1320px) 50vw, 660px';
    case 'third':
      return '(max-width: 768px) 100vw, (max-width: 1320px) 33vw, 440px';
    case 'quarter':
      return '(max-width: 768px) 50vw, (max-width: 1320px) 25vw, 330px';
  }
}

/** `3/4` → 0.75. Null on anything unparseable, never NaN. */
export function ratioToNumber(ratio: string | null | undefined): number | null {
  if (!ratio) return null;
  const parts = ratio.split('/');
  if (parts.length !== 2) return null;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
  return w / h;
}

/**
 * The aspect ratio a photograph naturally has, as the design writes them.
 *
 * Snapped to the vocabulary the masonry and strip layouts use rather than
 * reported exactly, because a cell of `1.4983/1` is a cell that does not line
 * up with the one beside it.
 */
export function snapRatio(width: number, height: number): string {
  const CANDIDATES: readonly (readonly [string, number])[] = [
    ['3/2', 3 / 2],
    ['16/9', 16 / 9],
    ['4/3', 4 / 3],
    ['1/1', 1],
    ['3/4', 3 / 4],
    ['2/3', 2 / 3],
  ];
  const actual = width / height;

  let bestName = '3/2';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, ratio] of CANDIDATES) {
    const distance = Math.abs(ratio - actual);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = name;
    }
  }
  return bestName;
}
