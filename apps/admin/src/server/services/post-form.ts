import 'server-only';

import { JOURNAL_CATEGORIES } from '@lotuspeak/api-contracts';

import { db } from '@/lib/db';
import { resolveRichTextMedia } from '@/server/schema/rich-text';
import { CATEGORY_TO_WIRE, culturePath, destinationPath, postPath } from './content-paths';
import { EDITOR_MEDIA, editorFigureMedia, previewImage, seoFormValue } from './content-editor';
import { emptySeo, toPicked } from './trip-form';
import type { PostFormData } from '@/components/content/post-editor';
import type { ContentPreviewData } from '@/components/content/content-preview';

export async function postFormData(id: string): Promise<PostFormData | null> {
  const post = await db.post.findFirst({
    where: { id, deletedAt: null },
    include: {
      hero: EDITOR_MEDIA,
      ogImage: EDITOR_MEDIA,
      tripLinks: { orderBy: { sortOrder: 'asc' }, select: { tripId: true } },
      destinations: { orderBy: { sortOrder: 'asc' }, select: { destinationId: true } },
      culture: { orderBy: { sortOrder: 'asc' }, select: { cultureId: true } },
    },
  });
  if (!post) return null;

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    category: post.category,
    /* The same resolution the public API does, for the same reason: the column
       holds media ids, and the editor needs a URL to draw the photograph. A
       body loaded with a stale URL in it would be saved back with that URL. */
    body: resolveRichTextMedia(post.body, await editorFigureMedia(post.body)),
    hero: toPicked(post.hero),
    ogImage: toPicked(post.ogImage),
    authorId: post.authorId,
    tags: post.tags.join(', '),
    relatedTripIds: post.tripLinks.map((link) => link.tripId),
    destinationIds: post.destinations.map((link) => link.destinationId),
    cultureIds: post.culture.map((link) => link.cultureId),
    featured: post.featured,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    seo: seoFormValue(post),
  };
}

export function emptyPostForm(): PostFormData {
  return {
    id: null,
    slug: '',
    title: '',
    standfirst: '',
    category: 'STORIES',
    body: '',
    hero: null,
    ogImage: null,
    authorId: null,
    tags: '',
    relatedTripIds: [],
    destinationIds: [],
    cultureIds: [],
    featured: false,
    status: 'DRAFT',
    publishedAt: null,
    seo: { ...emptySeo(), sitemapPriority: 0.6, sitemapChangeFreq: 'monthly' },
  };
}

export async function postPreviewData(id: string): Promise<ContentPreviewData | null> {
  const post = await db.post.findFirst({
    where: { id, deletedAt: null },
    include: {
      hero: EDITOR_MEDIA,
      author: { select: { name: true } },
      tripLinks: {
        orderBy: { sortOrder: 'asc' },
        include: { trip: { select: { id: true, title: true, slug: true, status: true } } },
      },
      destinations: {
        orderBy: { sortOrder: 'asc' },
        include: {
          destination: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              parent: { select: { slug: true, name: true } },
            },
          },
        },
      },
      culture: {
        orderBy: { sortOrder: 'asc' },
        include: { culture: { select: { id: true, title: true, slug: true, status: true } } },
      },
    },
  });
  if (!post) return null;

  const category = JOURNAL_CATEGORIES.find((c) => c.key === CATEGORY_TO_WIRE[post.category]);
  const dated = post.publishedAt
    ? post.publishedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not published yet';

  return {
    kind: 'post',
    id: post.id,
    title: post.title,
    path: postPath(post.slug),
    status: post.status,
    updatedAt: post.updatedAt.toISOString(),
    eyebrow: `Journal · ${category?.label ?? 'Stories'} · ${dated}`,
    standfirst: post.standfirst,
    blurb: null,
    body: resolveRichTextMedia(post.body, await editorFigureMedia(post.body)),
    image: previewImage(post.hero),
    icon: null,
    facts: [
      ['Written by', post.author?.name ?? 'Lotus Peak'],
      ['Reading time', `${post.readingMinutes} min`],
      ...(post.tags.length ? [['Tags', post.tags.join(', ')] as [string, string]] : []),
    ],
    seo: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.standfirst,
      noIndex: post.noIndex,
    },
    parent: null,
    places: null,
    links: [
      {
        title: 'Places it is about',
        hint: 'The entry is listed on each of these pages.',
        items: post.destinations.map((link) => ({
          title: link.destination.parent
            ? `${link.destination.name}, ${link.destination.parent.name}`
            : link.destination.name,
          status: link.destination.status,
          href: `/destinations/${link.destination.id}`,
          detail: destinationPath(link.destination.slug, link.destination.parent?.slug),
        })),
      },
      {
        title: 'Culture it explains',
        hint: 'The entry is listed on each of these pages.',
        items: post.culture.map((link) => ({
          title: link.culture.title,
          status: link.culture.status,
          href: `/culture/${link.culture.id}`,
          detail: culturePath(link.culture.slug),
        })),
      },
      {
        title: 'Journeys it mentions',
        hint: 'A link to the entry appears on each journey.',
        items: post.tripLinks.map((link) => ({
          title: link.trip.title,
          status: link.trip.status,
          href: `/trips/${link.trip.id}`,
          detail: `/trips/${link.trip.slug}`,
        })),
      },
    ],
  };
}
