import 'server-only';

import { db } from '@/lib/db';
import { parsePostBody } from '@/server/schema/blocks';
import { emptySeo, toPicked } from './trip-form';
import type { PostFormData } from '@/components/content/post-editor';
import type { EditorBlock } from '@/components/editor/block-editor';
import type { PickedMedia } from '@/components/media/media-picker';

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

  const stored = parsePostBody(post.body, `post:${post.slug}`);

  /**
   * The photographs a body refers to, fetched in one query.
   *
   * The column holds ids; the editor needs the whole media row to draw a
   * thumbnail. One `findMany` for the lot, rather than the picker fetching
   * each one as it renders.
   */
  const mediaIds = stored
    .filter((block) => block.kind === 'image')
    .map((block) => (block as { mediaId: string }).mediaId);

  const media = mediaIds.length
    ? await db.media.findMany({ where: { id: { in: mediaIds } }, include: MEDIA.include })
    : [];
  const byId = new Map<string, PickedMedia>();
  for (const row of media) {
    const picked = toPicked(row);
    if (picked) byId.set(row.id, picked);
  }

  const body: EditorBlock[] = stored.map((block) => {
    const key = crypto.randomUUID();
    if (block.kind === 'image') {
      return { key, kind: 'image', media: byId.get(block.mediaId) ?? null, ratio: block.ratio };
    }
    return { key, ...block } as EditorBlock;
  });

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    region: post.region,
    body,
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

export function emptyPostForm(): PostFormData {
  return {
    id: null,
    slug: '',
    title: '',
    standfirst: '',
    region: '',
    body: [],
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
