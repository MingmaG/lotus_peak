import 'server-only';

import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { TRIP_DETAIL_INCLUDE, type TripDetail } from './trip';
import type { TripFormData } from '@/components/treks/trip-editor';
import type { PickedMedia } from '@/components/media/media-picker';
import type { Media, MediaRendition } from '@prisma/client';

/**
 * A journey, as the editor's form object.
 *
 * On the server so the page renders with its data already in it — no spinner,
 * no second round trip, and the form is populated in the HTML for anybody
 * whose JavaScript is slow to arrive.
 */

export async function tripFormData(id: string): Promise<TripFormData | null> {
  const trip = await db.trip.findUnique({ where: { id }, include: TRIP_DETAIL_INCLUDE });
  return trip ? toForm(trip) : null;
}

export function emptyTripForm(): TripFormData {
  return {
    id: null,
    slug: '',
    title: '',
    excerpt: '',
    type: 'MINDFULNESS',
    journeyLabel: '',
    durationDays: 7,
    nights: 6,
    highPointMetres: 0,
    difficulty: 'MODERATE',
    priceFromUsd: 0,
    seasonLabel: '',
    seasonKeys: [],
    paceNote: '',
    groupSizeMin: null,
    groupSizeMax: null,
    regions: [],
    overview: [],
    highlights: [],
    included: [],
    excluded: [],
    itinerary: [],
    faqs: [],
    gallery: [],
    hero: null,
    ogImage: null,
    destinationIds: [],
    offeredByDestinationIds: [],
    relatedTripIds: [],
    featured: false,
    status: 'DRAFT',
    seo: emptySeo(),
  };
}

export function emptySeo() {
  return {
    metaTitle: null,
    schemaJson: null,
    metaDescription: null,
    canonicalUrl: null,
    noIndex: false,
    noFollow: false,
    ogTitle: null,
    ogDescription: null,
    ogImageId: null,
    twitterCard: 'summary_large_image' as const,
    keywords: [],
    focusKeyword: null,
    sitemapPriority: 0.8,
    sitemapChangeFreq: 'weekly' as const,
  };
}

function toForm(trip: TripDetail): TripFormData {
  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    excerpt: trip.excerpt,
    type: trip.type,
    journeyLabel: trip.journeyLabel,
    durationDays: trip.durationDays,
    nights: trip.nights,
    highPointMetres: trip.highPointMetres,
    difficulty: trip.difficulty,
    priceFromUsd: trip.priceFromUsd,
    seasonLabel: trip.seasonLabel,
    seasonKeys: trip.seasonKeys,
    paceNote: trip.paceNote,
    groupSizeMin: trip.groupSizeMin,
    groupSizeMax: trip.groupSizeMax,
    regions: trip.regions,
    overview: trip.overview,
    highlights: trip.highlights.map((row) => row.text),
    included: trip.inclusions.filter((row) => row.isIncluded).map((row) => row.text),
    excluded: trip.inclusions.filter((row) => !row.isIncluded).map((row) => row.text),
    itinerary: trip.itinerary.map((day) => ({
      /* The row id is the drag key. It survives a reorder within the session,
         and a save replaces the rows and hands back new ones — which is why
         the editor reloads after a save rather than keeping its own list. */
      key: day.id,
      isRest: day.isRest,
      title: day.title,
      meta: day.meta ?? '',
      body: day.body ?? '',
    })),
    faqs: trip.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
    gallery: trip.gallery.map((item) => ({
      mediaId: item.mediaId,
      url: pick(item.media),
      alt: item.media.alt,
      ratio: item.ratio,
      width: item.width,
    })),
    hero: toPicked(trip.hero),
    ogImage: toPicked(trip.ogImage),
    destinationIds: trip.destinations.map((link) => link.destinationId),
    offeredByDestinationIds: trip.destinations
      .filter((link) => link.offerOrder !== null)
      .sort((a, b) => (a.offerOrder ?? 0) - (b.offerOrder ?? 0))
      .map((link) => link.destinationId),
    relatedTripIds: trip.relatedFrom.map((link) => link.targetId),
    featured: trip.featured,
    status: trip.status,
    seo: {
      metaTitle: trip.metaTitle,
      schemaJson: trip.schemaJson ?? null,
      metaDescription: trip.metaDescription,
      canonicalUrl: trip.canonicalUrl,
      noIndex: trip.noIndex,
      noFollow: trip.noFollow,
      ogTitle: trip.ogTitle,
      ogDescription: trip.ogDescription,
      ogImageId: trip.ogImageId,
      twitterCard: trip.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
      keywords: trip.keywords,
      focusKeyword: trip.focusKeyword,
      sitemapPriority: trip.sitemapPriority,
      sitemapChangeFreq: trip.sitemapChangeFreq as never,
    },
  };
}

type WithRenditions = Media & { renditions?: MediaRendition[] };

/** The smallest WebP, because these are thumbnails in a form. */
function pick(media: WithRenditions): string {
  const smallest = [...(media.renditions ?? [])].sort((a, b) => a.width - b.width)[0];
  return storage.publicUrl(smallest?.storageKey ?? media.storageKey);
}

export function toPicked(media: WithRenditions | null): PickedMedia | null {
  if (!media) return null;
  return {
    id: media.id,
    url: pick(media),
    alt: media.alt,
    width: media.width,
    height: media.height,
    filename: media.filename,
    isDecorative: media.isDecorative,
    focalX: media.focalX,
    focalY: media.focalY,
    sizeBytes: media.sizeBytes,
  };
}
