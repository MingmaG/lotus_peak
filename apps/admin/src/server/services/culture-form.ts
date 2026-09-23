import 'server-only';

import { db } from '@/lib/db';
import { resolveRichTextMedia } from '@/server/schema/rich-text';
import { culturePath, destinationPath, postPath } from './content-paths';
import { EDITOR_MEDIA, editorFigureMedia, previewImage, seoFormValue } from './content-editor';
import { emptySeo, toPicked } from './trip-form';
import type { CultureFormData } from '@/components/content/culture-editor';
import type { ContentPreviewData } from '@/components/content/content-preview';

const ICON_LABEL: Record<string, string> = {
  DZONG: 'dzong',
  CHORTEN: 'chorten',
  STUPA: 'stupa',
  MONASTERY: 'monastery',
  PAVILION: 'pavilion',
  DZONG_LONG: 'dzong-long',
  BUDDHA: 'buddha',
};

export async function cultureFormData(id: string): Promise<CultureFormData | null> {
  const row = await db.cultureArticle.findFirst({
    where: { id, deletedAt: null },
    include: {
      image: EDITOR_MEDIA,
      ogImage: EDITOR_MEDIA,
      destinations: { orderBy: { sortOrder: 'asc' }, select: { destinationId: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    body: resolveRichTextMedia(row.body, await editorFigureMedia(row.body)),
    icon: row.icon,
    image: toPicked(row.image),
    ogImage: toPicked(row.ogImage),
    destinationIds: row.destinations.map((link) => link.destinationId),
    status: row.status,
    seo: seoFormValue(row),
  };
}

export function emptyCultureForm(): CultureFormData {
  return {
    id: null,
    slug: '',
    title: '',
    standfirst: '',
    body: '',
    icon: 'CHORTEN',
    image: null,
    ogImage: null,
    destinationIds: [],
    status: 'DRAFT',
    seo: { ...emptySeo(), sitemapPriority: 0.6, sitemapChangeFreq: 'monthly' },
  };
}

export async function culturePreviewData(id: string): Promise<ContentPreviewData | null> {
  const row = await db.cultureArticle.findFirst({
    where: { id, deletedAt: null },
    include: {
      image: EDITOR_MEDIA,
      destinations: {
        orderBy: { sortOrder: 'asc' },
        include: {
          destination: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              deletedAt: true,
              parent: { select: { slug: true, name: true } },
            },
          },
        },
      },
      posts: {
        include: { post: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } } },
      },
    },
  });
  if (!row) return null;

  return {
    kind: 'culture',
    id: row.id,
    title: row.title,
    path: culturePath(row.slug),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    eyebrow: 'Culture',
    standfirst: row.standfirst,
    blurb: null,
    body: resolveRichTextMedia(row.body, await editorFigureMedia(row.body)),
    image: previewImage(row.image),
    icon: ICON_LABEL[row.icon] ?? null,
    facts: [],
    seo: {
      title: row.metaTitle || row.title,
      description: row.metaDescription || row.standfirst,
      noIndex: row.noIndex,
    },
    parent: null,
    places: null,
    links: [
      {
        title: 'Where to see it',
        hint: 'Chosen on the Links tab of this piece.',
        items: row.destinations
          .filter((link) => !link.destination.deletedAt)
          .map((link) => ({
            title: link.destination.parent
              ? `${link.destination.name}, ${link.destination.parent.name}`
              : link.destination.name,
            status: link.destination.status,
            href: `/destinations/${link.destination.id}`,
            detail: destinationPath(link.destination.slug, link.destination.parent?.slug),
          })),
      },
      {
        title: 'Journal entries about it',
        hint: 'Linked from each entry’s Links tab.',
        items: row.posts
          .filter((link) => !link.post.deletedAt)
          .map((link) => ({
            title: link.post.title,
            status: link.post.status,
            href: `/journal/${link.post.id}`,
            detail: postPath(link.post.slug),
          })),
      },
    ],
  };
}
