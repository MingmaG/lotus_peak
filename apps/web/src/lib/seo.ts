import type { Metadata } from 'next'
import type { EntitySeo } from '@/content/types'

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

/**
 * A detail page's metadata, from its record and the record's SEO tab.
 *
 * Where we go, Culture and the journal all have one of these, and before they
 * shared this each page wrote its own `title: post.title` and quietly ignored
 * every override the office had typed — the meta title, the canonical, the
 * `noindex`. One function means an override set in the panel reaches the page,
 * and the fallbacks are the same everywhere: the record's title, its
 * standfirst, its photograph.
 *
 * The canonical is always set. Without one, `?utm_source=` on a shared link is
 * a second URL for the same page as far as a crawler is concerned.
 */
export function entityMetadata(args: {
  path: string
  title: string
  description: string
  image: string
  seo: EntitySeo
  type?: 'website' | 'article'
  publishedTime?: string
}): Metadata {
  const { seo } = args
  const title = seo.title?.trim() || args.title
  const description = seo.description?.trim() || args.description
  const image = seo.ogImage || args.image

  return {
    title,
    description,
    keywords: seo.keywords.length ? seo.keywords : undefined,
    alternates: { canonical: seo.canonical?.trim() || args.path },
    robots: { index: !seo.noIndex, follow: !seo.noFollow },
    openGraph: {
      type: args.type ?? 'website',
      title: seo.ogTitle?.trim() || title,
      description: seo.ogDescription?.trim() || description,
      url: args.path,
      images: image ? (ogImage(image) ?? [{ url: image }]) : undefined,
      ...(args.type === 'article' && args.publishedTime
        ? { publishedTime: args.publishedTime, modifiedTime: seo.updatedAt ?? undefined }
        : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}
