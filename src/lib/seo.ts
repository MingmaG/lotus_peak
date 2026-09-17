import type { Metadata } from 'next'
import { media } from './assets'

/**
 * The `openGraph.images` entry for a brand image.
 *
 * Crawlers and the social cards want absolute URLs, real dimensions and a
 * description. `metadataBase` in the root layout makes the root-relative `src`
 * absolute; the dimensions and alt come from the media record, so they cannot
 * drift from the file the way hand-written numbers do.
 *
 * Images are served at their own aspect ratio rather than cropped to 1200×630.
 * Every consumer crops to its own card shape anyway, and a crop generated here
 * would be one more derivative to keep in step with the photograph.
 */
export function ogImage(src: string): NonNullable<Metadata['openGraph']>['images'] {
  const asset = media(src)
  if (!asset) return undefined
  return [{ url: asset.src, width: asset.width, height: asset.height, alt: asset.alt }]
}
