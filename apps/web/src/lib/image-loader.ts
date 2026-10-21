import { RENDITION_WIDTHS } from '@lotuspeak/media'

/**
 * Where a photograph is actually fetched from.
 *
 * The admin panel builds five WebP renditions of every photograph when it is
 * uploaded — 400, 800, 1200, 1600, 2400 — and writes them to the media store.
 * Without a loader `next/image` ignored every one of them: each photograph went
 * through `/_next/image?url=…`, so the box running the website downloaded the
 * 2400 px rendition from S3, re-encoded it, and kept the result under
 * `.next/cache/images` for a year. The encoding was done twice, the website's
 * disk slowly filled with a second copy of the media library, and a phone on a
 * cold render still waited for the 2400 px fetch before anything appeared.
 *
 * This replaces that route entirely. `next/image` asks for a width and gets
 * back the rendition that already exists at that width, so the browser fetches
 * it straight from the media store and the website's own box is not in the
 * path at all. `srcset` stops being five sizes of one file and becomes the five
 * files the panel built.
 *
 * Configured as `images.loaderFile`, so it applies to every `<Image>` in the
 * app and `/_next/image` is never requested — that is the point, and it is also
 * why the two kinds of `src` below both have to be handled here.
 */

/**
 * A rendition URL: `…/media/<id>/<width>.<format>`.
 *
 * Deliberately matched on shape rather than on the media origin. The store is
 * MinIO here, S3 or Supabase in production, and the `local` storage driver
 * serves the same keys from the panel's own `/api/storage/…` — reading
 * `MEDIA_PUBLIC_URL` would mean a loader that works in production and quietly
 * stops rewriting on a box configured the other way.
 */
const RENDITION = /^(.*\/media\/[^/]+\/)(\d+)\.(avif|webp|jpeg|jpg|png)$/

export default function mediaLoader({ src, width }: { src: string; width: number }): string {
  const match = RENDITION.exec(src)

  /**
   * Anything that is not a rendition is returned untouched, which is how the
   * brand chrome under `public/assets` — the logo, the window ornaments, the
   * dignities, the footer scene — keeps working. Those are served as the files
   * they are, with the year/day cache headers `next.config.mjs` sets on them,
   * and they are the only images the website's own box still serves.
   */
  if (!match) return src

  const [, prefix, largest, format] = match

  /**
   * The width in the URL is the ceiling, not a coincidence.
   *
   * The panel hands the website its largest WebP rendition, and `widthsFor`
   * never upscales — so every rendition at or below that width exists in the
   * store and none above it does. Asking for 2400 of a photograph that was
   * uploaded at 900 would be a 404 on a page that previously rendered.
   */
  const ceiling = Number(largest)
  const available = RENDITION_WIDTHS.filter((w) => w <= ceiling)

  /* `quality` is not a parameter here. A rendition was encoded once, at upload,
     at the quality the panel chose; there is nothing left to re-encode. */
  const chosen = available.find((w) => w >= width) ?? ceiling

  return `${prefix}${chosen}.${format}`
}
