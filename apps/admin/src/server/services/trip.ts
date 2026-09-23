import 'server-only';

import { Prisma } from '@prisma/client';
import type { Trip } from '@prisma/client';

import { db } from '@/lib/db';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { changeSlug, resolvePublishing } from './publish';
import type { TripPatch } from '@/server/validators/trip';

/**
 * Writing a journey.
 *
 * The complicated part is the children — itinerary, highlights, inclusions,
 * FAQs, gallery, and three joins — and the rule for all of them is the same:
 * **a list that is present in the patch is replaced whole; a list that is
 * absent is left alone.**
 *
 * That combination is what makes the editor's autosave safe. It sends only the
 * tab somebody is on, so saving the SEO tab cannot touch the itinerary, and
 * saving the itinerary replaces it in one transaction rather than diffing
 * fourteen rows against fourteen rows and getting the order wrong.
 *
 * Replacing rather than diffing costs the child ids on every save. Nothing
 * refers to them — they are trip-scoped value objects — so the only thing lost
 * is the row's `createdAt`, which nothing shows.
 */

export const TRIP_DETAIL_INCLUDE = {
  hero: { include: { renditions: { where: { format: 'webp' } } } },
  routeMap: { include: { renditions: { where: { format: 'webp' } } } },
  ogImage: { include: { renditions: { where: { format: 'webp' } } } },
  highlights: { orderBy: { sortOrder: 'asc' } },
  inclusions: { orderBy: { sortOrder: 'asc' } },
  faqs: { orderBy: { sortOrder: 'asc' } },
  faqGroups: { orderBy: { sortOrder: 'asc' } },
  pricingTiers: { orderBy: { sortOrder: 'asc' } },
  itinerary: {
    orderBy: { sortOrder: 'asc' },
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
        include: { media: { include: { renditions: { where: { format: 'webp' } } } } },
      },
    },
  },
  gallery: {
    orderBy: { sortOrder: 'asc' },
    include: { media: { include: { renditions: { where: { format: 'webp' } } } } },
  },
  destinations: {
    orderBy: { routeOrder: 'asc' },
    include: { destination: { select: { id: true, name: true, slug: true } } },
  },
  relatedFrom: {
    orderBy: { sortOrder: 'asc' },
    include: { target: { select: { id: true, title: true, slug: true } } },
  },
  cultureLinks: { orderBy: { sortOrder: 'asc' } },
  postLinks: { orderBy: { sortOrder: 'asc' } },
  departures: { orderBy: { startDate: 'asc' } },
} satisfies Prisma.TripInclude;

export type TripDetail = Prisma.TripGetPayload<{ include: typeof TRIP_DETAIL_INCLUDE }>;

export async function createTrip(input: TripPatch & { title: string }): Promise<TripDetail> {
  const taken = await db.trip.findMany({ select: { slug: true } });
  const slug = uniqueSlug(
    input.slug || input.title,
    taken.map((row) => row.slug),
  );

  const trip = await db.trip.create({
    data: {
      slug,
      title: input.title,
      excerpt: input.excerpt ?? '',
      type: input.type ?? 'MINDFULNESS',
      journeyLabel: input.journeyLabel ?? '',
      durationDays: input.durationDays ?? 1,
      nights: input.nights ?? 0,
      highPointMetres: input.highPointMetres ?? 0,
      difficulty: input.difficulty ?? 'MODERATE',
      priceFromUsd: input.priceFromUsd ?? 0,
      seasonLabel: input.seasonLabel ?? '',
      paceNote: input.paceNote ?? '',
      /* New journeys go to the end of the catalogue, not the start. */
      sortOrder: (await db.trip.count()) + 1,
      status: 'DRAFT',
    },
  });

  return updateTrip(trip.id, input);
}

export async function updateTrip(id: string, patch: TripPatch): Promise<TripDetail> {
  const current = await db.trip.findUnique({ where: { id } });
  if (!current) throw new Error('That journey no longer exists.');

  let slug = current.slug;
  let slugHistory = current.slugHistory;

  if (patch.slug && toSlug(patch.slug) !== current.slug) {
    const moved = await changeSlug({
      entity: 'trip',
      currentSlug: current.slug,
      nextSlug: patch.slug,
      currentHistory: current.slugHistory,
      pathPrefix: '/trips',
    });
    slug = moved.slug;
    slugHistory = moved.slugHistory;
  }

  const publishing =
    patch.status !== undefined
      ? resolvePublishing({
          next: patch.status,
          currentStatus: current.status,
          currentPublishedAt: current.publishedAt,
          scheduledFor: patch.scheduledFor ? new Date(patch.scheduledFor) : null,
          explicitPublishedAt: patch.publishedAt ? new Date(patch.publishedAt) : null,
        })
      : null;

  /**
   * One transaction.
   *
   * A save that updated the journey and then failed halfway through replacing
   * the itinerary would leave an eleven-day journey with four days in it —
   * published, because the status had already been written.
   */
  await db.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id },
      data: {
        slug,
        slugHistory,
        title: patch.title,
        excerpt: patch.excerpt,
        type: patch.type,
        journeyLabel: patch.journeyLabel,
        durationDays: patch.durationDays,
        nights: patch.nights,
        highPointMetres: patch.highPointMetres,
        difficulty: patch.difficulty,
        priceFromUsd: patch.priceFromUsd,
        seasonLabel: patch.seasonLabel,
        seasonKeys: patch.seasonKeys,
        paceNote: patch.paceNote,
        groupSizeMin: patch.groupSizeMin,
        groupSizeMax: patch.groupSizeMax,
        regions: patch.regions,
        overview: patch.overview,
        priceCurrency: patch.priceCurrency,
        priceNote: patch.priceNote === undefined ? undefined : patch.priceNote,
        videoUrl: patch.videoUrl === undefined ? undefined : patch.videoUrl,
        heroId: patch.heroId === undefined ? undefined : patch.heroId,
        routeMapId: patch.routeMapId === undefined ? undefined : patch.routeMapId,
        /* Json columns. `undefined` leaves the column alone — a save from the
           SEO tab must not empty the elevation profile — and an empty array is
           stored as `null`, so "has one" is one check rather than two. */
        stats: patch.stats === undefined ? undefined : patch.stats.length ? patch.stats : Prisma.DbNull,
        elevationProfile:
          patch.elevationProfile === undefined
            ? undefined
            : patch.elevationProfile.length
              ? patch.elevationProfile
              : Prisma.DbNull,
        featured: patch.featured,
        showGallery: patch.showGallery,
        showDestinations: patch.showDestinations,
        showCulture: patch.showCulture,
        showJournal: patch.showJournal,
        showRelated: patch.showRelated,
        sortOrder: patch.sortOrder,
        ...(publishing ?? {}),
        ...seoFields(patch),
      },
    });

    if (patch.highlights) {
      await tx.tripHighlight.deleteMany({ where: { tripId: id } });
      await tx.tripHighlight.createMany({
        data: patch.highlights
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text, index) => ({ tripId: id, text, sortOrder: index })),
      });
    }

    /* `included` and `excluded` are one table with a flag, so either one
       arriving replaces only its own half. */
    if (patch.included) {
      await tx.tripInclusion.deleteMany({ where: { tripId: id, isIncluded: true } });
      await tx.tripInclusion.createMany({
        data: patch.included
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text, index) => ({ tripId: id, text, isIncluded: true, sortOrder: index })),
      });
    }

    if (patch.excluded) {
      await tx.tripInclusion.deleteMany({ where: { tripId: id, isIncluded: false } });
      await tx.tripInclusion.createMany({
        data: patch.excluded
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text, index) => ({ tripId: id, text, isIncluded: false, sortOrder: index })),
      });
    }

    /**
     * The groups first, then the questions, because a question names its
     * group by a key the client made up.
     *
     * `groupKey` rather than an id: a heading created in the same save has no
     * id until this transaction writes it. The keys are mapped to the rows
     * here, and a question whose key names no group comes out ungrouped —
     * which is the right answer rather than an error to refuse a save over,
     * since an ungrouped question is a shape this journey supports.
     *
     * The two are replaced together. Writing groups without questions would
     * leave every question orphaned for the width of a request.
     */
    if (patch.faqGroups || patch.faqs) {
      const keyToId = new Map<string, string>();

      if (patch.faqGroups) {
        await tx.tripFaqGroup.deleteMany({ where: { tripId: id } });
        for (const [index, group] of patch.faqGroups.entries()) {
          const row = await tx.tripFaqGroup.create({
            data: {
              tripId: id,
              title: group.title.trim(),
              blurb: group.blurb?.trim() || null,
              sortOrder: index,
            },
          });
          keyToId.set(group.key, row.id);
        }
      } else {
        /* Questions saved without touching the headings: keep the existing
           ones and match on their title, which is what the client sends as a
           key when it did not create them. */
        const existing = await tx.tripFaqGroup.findMany({ where: { tripId: id } });
        for (const group of existing) keyToId.set(group.title, group.id);
      }

      if (patch.faqs) {
        await tx.tripFaq.deleteMany({ where: { tripId: id } });
        await tx.tripFaq.createMany({
          data: patch.faqs.map((faq, index) => ({
            tripId: id,
            question: faq.question.trim(),
            answer: faq.answer.trim(),
            groupId: faq.groupKey ? (keyToId.get(faq.groupKey) ?? null) : null,
            sortOrder: index,
          })),
        });
      }
    }

    if (patch.pricingTiers) {
      await tx.tripPricingTier.deleteMany({ where: { tripId: id } });
      await tx.tripPricingTier.createMany({
        data: patch.pricingTiers.map((tier, index) => ({
          tripId: id,
          label: tier.label.trim(),
          minPeople: tier.minPeople,
          maxPeople: tier.maxPeople ?? null,
          priceUsd: tier.priceUsd,
          wasPriceUsd: tier.wasPriceUsd ?? null,
          note: tier.note?.trim() || null,
          sortOrder: index,
        })),
      });
    }

    if (patch.itinerary) {
      await tx.itineraryDay.deleteMany({ where: { tripId: id } });
      for (const [index, day] of patch.itinerary.entries()) {
        const row = await tx.itineraryDay.create({
          data: {
            tripId: id,
            isRest: day.isRest,
            title: day.title.trim(),
            meta: day.meta?.trim() || null,
            body: day.body?.trim() || null,
            sortOrder: index,
          },
        });
        if (day.mediaIds?.length) {
          await tx.itineraryImage.createMany({
            data: day.mediaIds.map((mediaId, position) => ({
              dayId: row.id,
              mediaId,
              sortOrder: position,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    if (patch.gallery) {
      await tx.tripGalleryItem.deleteMany({ where: { tripId: id } });
      await tx.tripGalleryItem.createMany({
        data: patch.gallery.map((item, index) => ({
          tripId: id,
          mediaId: item.mediaId,
          ratio: item.ratio ?? null,
          width: item.width ?? null,
          sortOrder: index,
        })),
        skipDuplicates: true,
      });
    }

    /**
     * The two ends of the destination join, set independently.
     *
     * `destinationIds` is the route — which places this journey visits, in
     * order. `offeredByDestinationIds` is which of those places put it on
     * their own page. A place on the route that is not in the second list
     * keeps `offerOrder: null`, which is what says "passes through, not
     * offered here".
     */
    if (patch.destinationIds) {
      await tx.tripOnDestination.deleteMany({ where: { tripId: id } });
      const offered = patch.offeredByDestinationIds ?? [];
      await tx.tripOnDestination.createMany({
        data: patch.destinationIds.map((destinationId, index) => ({
          tripId: id,
          destinationId,
          routeOrder: index,
          offerOrder: offered.includes(destinationId)
            ? offered.indexOf(destinationId)
            : null,
        })),
        skipDuplicates: true,
      });
    } else if (patch.offeredByDestinationIds) {
      /* Only the offer side changed — update in place rather than rebuilding
         the route order from nothing. */
      const offered = patch.offeredByDestinationIds;
      await tx.tripOnDestination.updateMany({
        where: { tripId: id },
        data: { offerOrder: null },
      });
      for (const [index, destinationId] of offered.entries()) {
        await tx.tripOnDestination.updateMany({
          where: { tripId: id, destinationId },
          data: { offerOrder: index },
        });
      }
    }

    if (patch.relatedTripIds) {
      await tx.tripRelated.deleteMany({ where: { sourceId: id } });
      await tx.tripRelated.createMany({
        data: patch.relatedTripIds
          /* A journey cannot be related to itself, and the picker will not
             offer it — but a stale form or an import can still send it. */
          .filter((targetId) => targetId !== id)
          .map((targetId, index) => ({ sourceId: id, targetId, sortOrder: index })),
        skipDuplicates: true,
      });
    }

    if (patch.cultureIds) {
      await tx.cultureOnTrip.deleteMany({ where: { tripId: id } });
      await tx.cultureOnTrip.createMany({
        data: patch.cultureIds.map((cultureId, index) => ({
          tripId: id,
          cultureId,
          sortOrder: index,
        })),
        skipDuplicates: true,
      });
    }

    /**
     * The entry ↔ journey join, from the journey's end.
     *
     * The entry's editor writes the same rows from the other end, so a link
     * made there arrives here checked, and one removed here is gone from the
     * entry too. `sortOrder` is left at the entry's own value where the row
     * already existed — it orders the entry's journeys, not the journey's
     * entries, and the page orders those by date.
     */
    if (patch.postIds) {
      await tx.postOnTrip.deleteMany({
        where: { tripId: id, postId: { notIn: patch.postIds } },
      });
      await tx.postOnTrip.createMany({
        data: patch.postIds.map((postId) => ({ tripId: id, postId })),
        skipDuplicates: true,
      });
    }
  });

  const trip = await db.trip.findUnique({ where: { id }, include: TRIP_DETAIL_INCLUDE });
  if (!trip) throw new Error('That journey no longer exists.');
  return trip;
}

/**
 * The SEO half of an update.
 *
 * `Prisma.TripUncheckedUpdateInput`, and foreign keys are written as ids
 * rather than `{ connect: … }`. Prisma's two update shapes cannot be mixed in
 * one object, and the rest of this update sets `heroId` directly — so a
 * `connect` here is a type error whose message names neither field.
 */
function seoFields(patch: TripPatch): Prisma.TripUncheckedUpdateInput {
  const seo = patch.seo;
  if (!seo) return {};
  return {
    metaTitle: seo.metaTitle,
    metaDescription: seo.metaDescription,
    canonicalUrl: seo.canonicalUrl,
    noIndex: seo.noIndex,
    noFollow: seo.noFollow,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImageId: seo.ogImageId === undefined ? undefined : seo.ogImageId,
    twitterCard: seo.twitterCard,
    keywords: seo.keywords,
    focusKeyword: seo.focusKeyword,
    sitemapPriority: seo.sitemapPriority,
    sitemapChangeFreq: seo.sitemapChangeFreq,
    schemaJson: seo.schemaJson === undefined ? undefined : (seo.schemaJson as never),
  };
}

/**
 * Deleted, but recoverable.
 *
 * `deletedAt` rather than a real delete, because a journey is referred to by
 * enquiries, destinations, journal entries and pages, and a hard delete either
 * cascades into all of them or fails with a foreign-key error nobody can read.
 * The site filters on it; the list screen offers to restore.
 */
export async function softDeleteTrip(id: string): Promise<Trip> {
  return db.trip.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });
}

export async function restoreTrip(id: string): Promise<Trip> {
  return db.trip.update({
    where: { id },
    data: { deletedAt: null, status: 'DRAFT' },
  });
}

/**
 * Builds the region line from the route.
 *
 * Offered as a button in the editor rather than done automatically, because
 * the Jomolhari trek's line names a mountain that is not a destination. The
 * office presses it, sees what it produced, and corrects it.
 */
export async function regionsFromRoute(destinationIds: string[]): Promise<string[]> {
  if (destinationIds.length === 0) return [];
  const rows = await db.destination.findMany({
    where: { id: { in: destinationIds } },
    select: { id: true, name: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row.name]));
  return destinationIds
    .map((id) => byId.get(id))
    .filter((name): name is string => name !== undefined);
}
