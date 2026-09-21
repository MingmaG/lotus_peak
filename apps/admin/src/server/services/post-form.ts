import 'server-only';

import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { resolveRichTextMedia, richTextMediaIds, type FigureMedia } from '@/server/schema/rich-text';
import { emptySeo, toPicked } from './trip-form';
import type { PostFormData } from '@/components/content/post-editor';

const MEDIA = { include: { renditions: { where: { format: 'webp' as const } } } };

export async function postFormData(id: string): Promise<PostFormData | null> {
  const post = await db.post.findUnique({
    where: { id },
    include: {
      hero: MEDIA,
      ogImage: MEDIA,
      tripLinks: { orderBy: { sortOrder: 'asc' }, select: { tripId: true } },
    },
  });
  if (!post) return null;

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    region: post.region,
    /* The same resolution the public API does, for the same reason: the column
       holds media ids, and the editor needs a URL to draw the photograph. A
       body loaded with a stale URL in it would be saved back with that URL. */
    body: resolveRichTextMedia(post.body, await editorFigureMedia(post.body)),
    hero: toPicked(post.hero),
    ogImage: toPicked(post.ogImage),
    authorId: post.authorId,
    tags: post.tags.join(', '),
    relatedTripIds: post.tripLinks.map((link) => link.tripId),
    featured: post.featured,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    seo: {
      metaTitle: post.metaTitle,
      schemaJson: post.schemaJson ?? null,
      metaDescription: post.metaDescription,
      canonicalUrl: post.canonicalUrl,
      noIndex: post.noIndex,
      noFollow: post.noFollow,
      ogTitle: post.ogTitle,
      ogDescription: post.ogDescription,
      ogImageId: post.ogImageId,
      twitterCard: post.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
      keywords: post.keywords,
      focusKeyword: post.focusKeyword,
      sitemapPriority: post.sitemapPriority,
      sitemapChangeFreq: post.sitemapChangeFreq as never,
    },
  };
}

/**
 * The photographs a body's figures name, as the *editor* needs them.
 *
 * Not the public API's version: that one points at the largest WebP rendition,
 * which is right for a published page and is a 1600 px file to draw inside a
 * text box. This takes the smallest, the way the media picker does, and it
 * accepts a row with no dimensions — the library has to show the photograph
 * nobody has measured, because that is the one somebody needs to fix.
 */
async function editorFigureMedia(html: string): Promise<Map<string, FigureMedia>> {
  const ids = richTextMediaIds(html);
  if (ids.length === 0) return new Map();

  const rows = await db.media.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: MEDIA.include,
  });

  const map = new Map<string, FigureMedia>();
  for (const row of rows) {
    const smallest = [...row.renditions].sort((a, b) => a.width - b.width)[0];
    map.set(row.id, {
      url: storage.publicUrl(smallest?.storageKey ?? row.storageKey),
      alt: row.isDecorative ? '' : row.alt,
      width: row.width,
      height: row.height,
    });
  }
  return map;
}

export function emptyPostForm(): PostFormData {
  return {
    id: null,
    slug: '',
    title: '',
    standfirst: '',
    region: '',
    body: '',
    hero: null,
    ogImage: null,
    authorId: null,
    tags: '',
    relatedTripIds: [],
    featured: false,
    status: 'DRAFT',
    publishedAt: null,
    seo: { ...emptySeo(), sitemapPriority: 0.6, sitemapChangeFreq: 'monthly' },
  };
}
