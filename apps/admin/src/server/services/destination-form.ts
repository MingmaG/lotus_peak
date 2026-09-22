import 'server-only';

import { db } from '@/lib/db';
import { resolveRichTextMedia } from '@/server/schema/rich-text';
import { destinationPath, postPath, culturePath } from './content-paths';
import { EDITOR_MEDIA, editorFigureMedia, previewImage, seoFormValue } from './content-editor';
import { emptySeo, toPicked } from './trip-form';
import type { DestinationFormData } from '@/components/content/destination-editor';
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

/** The valleys a place can sit in: every row with no parent, but not itself. */
export async function valleyOptions(excludeId?: string) {
  return db.destination.findMany({
    where: { deletedAt: null, parentId: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}

export async function destinationFormData(id: string): Promise<DestinationFormData | null> {
  const row = await db.destination.findFirst({
    where: { id, deletedAt: null },
    include: {
      image: EDITOR_MEDIA,
      ogImage: EDITOR_MEDIA,
      _count: { select: { places: { where: { deletedAt: null } } } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parentId,
    hasPlaces: row._count.places > 0,
    icon: row.icon,
    blurb: row.blurb,
    standfirst: row.standfirst,
    /* The column holds media ids; the editor needs a URL to draw the
       photograph. A body loaded with a stale URL would be saved back with it. */
    body: resolveRichTextMedia(row.body, await editorFigureMedia(row.body)),
    image: toPicked(row.image),
    ogImage: toPicked(row.ogImage),
    altitudeMetres: row.altitudeMetres,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    seo: seoFormValue(row),
  };
}

export function emptyDestinationForm(parentId: string | null): DestinationFormData {
  return {
    id: null,
    slug: '',
    name: '',
    parentId,
    hasPlaces: false,
    icon: parentId ? 'MONASTERY' : 'DZONG',
    blurb: '',
    standfirst: '',
    body: '',
    image: null,
    ogImage: null,
    altitudeMetres: null,
    latitude: null,
    longitude: null,
    status: 'DRAFT',
    seo: { ...emptySeo(), sitemapPriority: parentId ? 0.6 : 0.7, sitemapChangeFreq: 'monthly' },
  };
}

/**
 * A destination as its preview page draws it.
 *
 * Everything the website's page will show, in the order it shows it, plus
 * the things only the office needs to see: where it is linked from, and what
 * a search result will say.
 */
export async function destinationPreviewData(id: string): Promise<ContentPreviewData | null> {
  const row = await db.destination.findFirst({
    where: { id, deletedAt: null },
    include: {
      image: EDITOR_MEDIA,
      parent: { select: { id: true, name: true, slug: true } },
      places: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        include: { image: EDITOR_MEDIA },
      },
      culture: {
        orderBy: { sortOrder: 'asc' },
        include: { culture: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } } },
      },
      posts: {
        include: { post: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } } },
      },
      trips: {
        where: { offerOrder: { not: null } },
        orderBy: { offerOrder: 'asc' },
        include: { trip: { select: { id: true, title: true, slug: true, status: true } } },
      },
    },
  });
  if (!row) return null;

  const path = destinationPath(row.slug, row.parent?.slug);

  return {
    kind: 'destination',
    id: row.id,
    title: row.name,
    path,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    eyebrow: row.parent ? `Where we go · ${row.parent.name}` : 'Where we go',
    standfirst: row.standfirst,
    blurb: row.blurb,
    body: resolveRichTextMedia(row.body, await editorFigureMedia(row.body)),
    image: previewImage(row.image),
    icon: ICON_LABEL[row.icon] ?? null,
    facts: [
      ...(row.altitudeMetres ? [['Altitude', `${row.altitudeMetres.toLocaleString('en-GB')} m`] as [string, string]] : []),
      ...(row.latitude !== null && row.longitude !== null
        ? [['Coordinates', `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}`] as [string, string]]
        : []),
    ],
    seo: {
      title: row.metaTitle || row.name,
      description: row.metaDescription || row.standfirst || row.blurb,
      noIndex: row.noIndex,
    },
    parent: row.parent
      ? { id: row.parent.id, title: row.parent.name, href: `/destinations/${row.parent.id}` }
      : null,
    places: row.parent
      ? null
      : row.places.map((place) => ({
          id: place.id,
          title: place.name,
          detail: place.blurb,
          status: place.status,
          href: `/destinations/${place.id}`,
          image: previewImage(place.image)?.url ?? null,
        })),
    links: [
      {
        title: 'Culture seen here',
        hint: 'Linked from the culture piece’s Links tab.',
        items: row.culture
          .filter((link) => !link.culture.deletedAt)
          .map((link) => ({
            title: link.culture.title,
            status: link.culture.status,
            href: `/culture/${link.culture.id}`,
            detail: culturePath(link.culture.slug),
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
      ...(row.parent
        ? []
        : [
            {
              title: 'Journeys offered here',
              hint: 'Set on each journey’s route. A place is offered by the journeys through its valley.',
              items: row.trips.map((link) => ({
                title: link.trip.title,
                status: link.trip.status,
                href: `/trips/${link.trip.id}`,
                detail: `/trips/${link.trip.slug}`,
              })),
            },
          ]),
    ],
  };
}
