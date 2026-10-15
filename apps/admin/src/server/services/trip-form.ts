import 'server-only';

import { parseElevationProfile, parseTripStats } from '@/server/schema/blocks';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { resolveRichTextMedia } from '@/server/schema/rich-text';
import { editorFigureMediaIn } from './content-editor';
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

/**
 * What the Links tab offers to choose from: every culture piece and every
 * journal entry that has not been deleted.
 *
 * Drafts included, and marked, because an entry is often written alongside
 * the journey it is about — it should be linkable before either is live. The
 * site only ever draws the published ones.
 */
export async function tripLinkOptions() {
  const [culture, posts] = await Promise.all([
    db.cultureArticle.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
    db.post.findMany({
      where: { deletedAt: null },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, status: true },
    }),
  ]);
  return {
    culture,
    posts: posts.map((row) => ({
      id: row.id,
      title: row.title,
      published: row.status === 'PUBLISHED',
    })),
  };
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
    priceCurrency: 'USD',
    priceNote: '',
    pricingTiers: [],
    seasonLabel: '',
    seasonKeys: [],
    paceNote: '',
    groupSizeMin: null,
    groupSizeMax: null,
    regions: [],
    overview: '',
    overviewImage: null,
    overviewInset: null,
    highlights: [],
    included: [],
    excluded: [],
    itinerary: [],
    faqs: [],
    faqGroups: [],
    gallery: [],
    stats: [],
    elevationProfile: [],
    videoUrl: '',
    routeMap: null,
    trail: { eyebrow: '', title: '', body: '', image: null },
    hero: null,
    ogImage: null,
    destinationIds: [],
    offeredByDestinationIds: [],
    relatedTripIds: [],
    cultureIds: [],
    postIds: [],
    sections: { ...ALL_SECTIONS },
    featured: false,
    status: 'DRAFT',
    seo: emptySeo(),
  };
}

/** Every band on, which is what the columns default to. */
const ALL_SECTIONS = {
  trail: true,
  gallery: true,
  destinations: true,
  culture: true,
  journal: true,
  related: true,
};

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

/**
 * A journey's four rich-text fields, as the editor reads them.
 *
 * Every figure in them is stored as a media id and nothing else, so the editor
 * would otherwise open on a photograph with no `src`. This fills them in from
 * the library — see `schema/rich-text.ts` — and `stripPatchMedia` in
 * `trip.ts` takes the URLs back out on the way to the column.
 */
async function toForm(trip: TripDetail): Promise<TripFormData> {
  const media = await editorFigureMediaIn([
    trip.overview,
    trip.priceNote,
    ...trip.itinerary.map((day) => day.body),
    ...trip.faqs.map((faq) => faq.answer),
    ...trip.faqGroups.map((group) => group.blurb),
  ]);
  const resolve = (html: string | null) => resolveRichTextMedia(html, media);

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
    priceCurrency: trip.priceCurrency,
    priceNote: resolve(trip.priceNote),
    pricingTiers: trip.pricingTiers.map((tier) => ({
      key: tier.id,
      label: tier.label,
      minPeople: tier.minPeople,
      maxPeople: tier.maxPeople,
      priceUsd: tier.priceUsd,
      wasPriceUsd: tier.wasPriceUsd,
      note: tier.note ?? '',
    })),
    seasonLabel: trip.seasonLabel,
    seasonKeys: trip.seasonKeys,
    paceNote: trip.paceNote,
    groupSizeMin: trip.groupSizeMin,
    groupSizeMax: trip.groupSizeMax,
    regions: trip.regions,
    overview: resolve(trip.overview),
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
      body: resolve(day.body),
      /* The day's own photographs, in the order the office put them in. */
      images: day.images.map((row) => toPicked(row.media)).filter(
        (picked): picked is PickedMedia => picked !== null,
      ),
    })),
    /**
     * A question refers to its heading by title, not by id.
     *
     * The editor builds new headings before they exist as rows, so the key it
     * uses has to be something it can invent. Reading them back by title keeps
     * the two directions symmetrical — see `groupKey` in the validator.
     */
    faqGroups: trip.faqGroups.map((group) => ({
      key: group.title,
      title: group.title,
      blurb: resolve(group.blurb),
    })),
    faqs: trip.faqs.map((faq) => ({
      question: faq.question,
      answer: resolve(faq.answer),
      groupKey:
        trip.faqGroups.find((group) => group.id === faq.groupId)?.title ?? null,
    })),
    stats: parseTripStats(trip.stats, `trip ${trip.slug}`),
    elevationProfile: parseElevationProfile(trip.elevationProfile, `trip ${trip.slug}`),
    videoUrl: trip.videoUrl ?? '',
    gallery: trip.gallery.map((item) => ({
      mediaId: item.mediaId,
      url: pick(item.media),
      alt: item.media.alt,
      ratio: item.ratio,
      width: item.width,
    })),
    hero: toPicked(trip.hero),
    trail: {
      eyebrow: trip.trailEyebrow,
      title: trip.trailTitle,
      body: trip.trailBody,
      image: toPicked(trip.trailImage),
    },
    overviewImage: toPicked(trip.overviewImage),
    overviewInset: toPicked(trip.overviewInset),
    routeMap: toPicked(trip.routeMap),
    ogImage: toPicked(trip.ogImage),
    destinationIds: trip.destinations.map((link) => link.destinationId),
    offeredByDestinationIds: trip.destinations
      .filter((link) => link.offerOrder !== null)
      .sort((a, b) => (a.offerOrder ?? 0) - (b.offerOrder ?? 0))
      .map((link) => link.destinationId),
    relatedTripIds: trip.relatedFrom.map((link) => link.targetId),
    cultureIds: trip.cultureLinks.map((link) => link.cultureId),
    postIds: trip.postLinks.map((link) => link.postId),
    sections: {
      trail: trip.showTrail,
      gallery: trip.showGallery,
      destinations: trip.showDestinations,
      culture: trip.showCulture,
      journal: trip.showJournal,
      related: trip.showRelated,
    },
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
    caption: media.caption,
    credit: media.credit,
    width: media.width,
    height: media.height,
    filename: media.filename,
    isDecorative: media.isDecorative,
    focalX: media.focalX,
    focalY: media.focalY,
    sizeBytes: media.sizeBytes,
  };
}
