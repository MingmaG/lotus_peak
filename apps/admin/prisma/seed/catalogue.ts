import type { Difficulty, SeasonKey, SiteIcon, TripType } from '@prisma/client';

import { db } from '@/lib/db';

import type { ImageMap } from './media';
import activities from '../seed-data/activities.json';
import culture from '../seed-data/culture.json';
import destinations from '../seed-data/destinations.json';
import gallery from '../seed-data/gallery.json';
import reflections from '../seed-data/reflections.json';
import seasons from '../seed-data/seasons.json';
import trips from '../seed-data/trips.json';

/**
 * The catalogue: journeys, places, activities, seasons, culture, the gallery
 * and the reflections.
 *
 * Everything is `upsert` on the slug and every child list is replaced whole.
 * Replacing rather than diffing is right for a seed: the JSON is the record of
 * what the site said on the day it moved, and a seed that merged would leave
 * an itinerary half from the file and half from wherever it had drifted to.
 *
 * It also means a re-seed **overwrites edits**, which is why `npm run db:seed`
 * is documented as a first-run command and `db:reset` is the one that throws
 * the database away.
 */

const now = new Date();

/* -------------------------------------------------------------------------- */
/*  Mapping the design's vocabulary onto the enums                             */
/* -------------------------------------------------------------------------- */

const TRIP_TYPE: Record<string, TripType> = {
  mindfulness: 'MINDFULNESS',
  meditation: 'MEDITATION',
  festival: 'FESTIVAL',
  trekking: 'TREKKING',
};

const DIFFICULTY: Record<string, Difficulty> = {
  Gentle: 'GENTLE',
  Moderate: 'MODERATE',
  Demanding: 'DEMANDING',
};

const SEASON_KEY: Record<string, SeasonKey> = {
  spring: 'SPRING',
  summer: 'SUMMER',
  autumn: 'AUTUMN',
  winter: 'WINTER',
};

const ICON: Record<string, SiteIcon> = {
  dzong: 'DZONG',
  chorten: 'CHORTEN',
  stupa: 'STUPA',
  monastery: 'MONASTERY',
  pavilion: 'PAVILION',
  'dzong-long': 'DZONG_LONG',
  buddha: 'BUDDHA',
};

/* -------------------------------------------------------------------------- */
/*  Shapes, as the export wrote them                                           */
/* -------------------------------------------------------------------------- */

interface TripJson {
  slug: string;
  title: string;
  excerpt: string;
  type: string;
  order: number;
  regions: string[];
  durationDays: number;
  nights: number;
  highPointMetres: number;
  difficulty: string;
  priceFromUsd: number;
  seasonLabel: string;
  paceNote: string;
  journeyLabel: string;
  heroImage: string;
  overview: string[];
  highlights: string[];
  itinerary: { day?: number; rest?: boolean; title: string; meta?: string; body?: string }[];
  included: string[];
  excluded: string[];
  faq: { question: string; answer: string }[];
  gallery: [string, string?, string?][];
}

interface DestinationJson {
  slug: string;
  name: string;
  icon: string;
  blurb: string;
  detail: string;
  image: string;
  tripSlugs: string[];
  order: number;
}

interface ActivityJson {
  slug: string;
  name: string;
  blurb: string;
  icon: string;
  image: string;
  examples: string[];
  tripSlugs: string[];
  order: number;
}

interface SeasonJson {
  key: string;
  monthsLabel: string;
  name: string;
  headline: string;
  summary: string;
  detail: string;
  image: string;
  order: number;
}

interface CultureJson {
  slug: string;
  title: string;
  body: string;
  icon: string;
  image: string;
  order: number;
}

interface GalleryJson {
  src: string;
  caption: string;
  ratio: string;
  order: number;
}

interface ReflectionJson {
  id: string;
  quote: string;
  name: string;
  detail?: string;
  tripSlug?: string;
  featured: boolean;
  order: number;
}

/* -------------------------------------------------------------------------- */

export async function seedCatalogue(images: ImageMap): Promise<void> {
  const media = (src: string | undefined | null) =>
    src ? (images.get(src) ?? null) : null;

  await seedSeasons(media);
  const tripIds = await seedTrips(media);
  const destinationIds = await seedDestinations(media);
  await linkTripsToDestinations(tripIds, destinationIds);
  await seedActivities(media, tripIds);
  await seedCulture(media);
  await seedGallery(media);
  await seedReflections(tripIds);
}

async function seedSeasons(media: (src?: string | null) => string | null): Promise<void> {
  for (const season of seasons as SeasonJson[]) {
    const key = SEASON_KEY[season.key];
    if (!key) continue;
    await db.season.upsert({
      where: { key },
      create: {
        key,
        name: season.name,
        monthsLabel: season.monthsLabel,
        headline: season.headline,
        summary: season.summary,
        detail: season.detail,
        imageId: media(season.image),
        sortOrder: season.order,
      },
      update: {
        name: season.name,
        monthsLabel: season.monthsLabel,
        headline: season.headline,
        summary: season.summary,
        detail: season.detail,
        imageId: media(season.image),
        sortOrder: season.order,
      },
    });
  }
  console.log(`  seasons      ${seasons.length}`);
}

async function seedTrips(
  media: (src?: string | null) => string | null,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const trip of trips as TripJson[]) {
    const type = TRIP_TYPE[trip.type] ?? 'MINDFULNESS';
    const difficulty = DIFFICULTY[trip.difficulty] ?? 'MODERATE';

    const base = {
      title: trip.title,
      excerpt: trip.excerpt,
      type,
      journeyLabel: trip.journeyLabel,
      durationDays: trip.durationDays,
      nights: trip.nights,
      highPointMetres: trip.highPointMetres,
      difficulty,
      priceFromUsd: trip.priceFromUsd,
      seasonLabel: trip.seasonLabel,
      seasonKeys: seasonKeysFrom(trip.seasonLabel),
      paceNote: trip.paceNote,
      regions: trip.regions,
      overview: trip.overview,
      heroId: media(trip.heroImage),
      sortOrder: trip.order,
      status: 'PUBLISHED' as const,
      publishedAt: now,
      /**
       * The excerpt as the meta description.
       *
       * Not left null. A page with no meta description gets whatever a search
       * engine lifts off it, which on a journey page is the eyebrow and half
       * the first heading. The excerpt is one sentence written to describe the
       * journey, which is exactly what the field wants — and the SEO tab shows
       * it as the inherited value so the office can see what it would be
       * replacing.
       */
      metaDescription: trip.excerpt,
    };

    const row = await db.trip.upsert({
      where: { slug: trip.slug },
      create: { slug: trip.slug, ...base },
      update: base,
    });
    ids.set(trip.slug, row.id);

    /* Children, replaced whole. See the note at the top of the file. */
    await db.tripHighlight.deleteMany({ where: { tripId: row.id } });
    await db.tripInclusion.deleteMany({ where: { tripId: row.id } });
    await db.tripFaq.deleteMany({ where: { tripId: row.id } });
    await db.tripGalleryItem.deleteMany({ where: { tripId: row.id } });
    await db.itineraryDay.deleteMany({ where: { tripId: row.id } });

    await db.tripHighlight.createMany({
      data: trip.highlights.map((text, index) => ({
        tripId: row.id,
        text,
        sortOrder: index,
      })),
    });

    await db.tripInclusion.createMany({
      data: [
        ...trip.included.map((text, index) => ({
          tripId: row.id,
          text,
          isIncluded: true,
          sortOrder: index,
        })),
        ...trip.excluded.map((text, index) => ({
          tripId: row.id,
          text,
          isIncluded: false,
          sortOrder: index,
        })),
      ],
    });

    await db.tripFaq.createMany({
      data: trip.faq.map((faq, index) => ({
        tripId: row.id,
        question: faq.question,
        answer: faq.answer,
        sortOrder: index,
      })),
    });

    /**
     * The itinerary, without its day numbers.
     *
     * The JSON carries `day: 3`, because a TypeScript literal had to. The
     * database does not: position and `isRest` are enough to compute it, and
     * storing it means an inserted arrival day makes every number after it
     * wrong.
     */
    await db.itineraryDay.createMany({
      data: trip.itinerary.map((day, index) => ({
        tripId: row.id,
        isRest: day.rest === true,
        title: day.title,
        meta: day.meta ?? null,
        body: day.body ?? null,
        sortOrder: index,
      })),
    });

    const galleryItems = trip.gallery
      .map(([src, ratio, width], index) => {
        const mediaId = media(src);
        return mediaId
          ? { tripId: row.id, mediaId, ratio: ratio ?? null, width: width ?? null, sortOrder: index }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    /* `skipDuplicates` because the design's gallery arrays repeat a photograph
       at two aspect ratios, and `(tripId, mediaId)` is unique. The first
       ratio wins, which is the one the design lists first. */
    if (galleryItems.length > 0) {
      await db.tripGalleryItem.createMany({ data: galleryItems, skipDuplicates: true });
    }
  }

  console.log(`  journeys     ${trips.length}`);
  return ids;
}

/**
 * Which seasons a journey runs in, from the prose label.
 *
 * `seasonLabel` is "Spring and autumn" because that is what the card prints
 * and the honest answer is not a month range. The enum array is derived from
 * it so the site can filter by season without the office maintaining the same
 * fact twice — and the Journeys screen shows both, with the derived one
 * editable, for the journey whose label does not name its seasons.
 */
function seasonKeysFrom(label: string): SeasonKey[] {
  const lower = label.toLowerCase();
  const keys: SeasonKey[] = [];
  if (lower.includes('spring')) keys.push('SPRING');
  if (lower.includes('summer')) keys.push('SUMMER');
  if (lower.includes('autumn') || lower.includes('fall')) keys.push('AUTUMN');
  if (lower.includes('winter')) keys.push('WINTER');
  return keys;
}

async function seedDestinations(
  media: (src?: string | null) => string | null,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const destination of destinations as DestinationJson[]) {
    const base = {
      name: destination.name,
      icon: ICON[destination.icon] ?? 'DZONG',
      blurb: destination.blurb,
      detail: destination.detail,
      imageId: media(destination.image),
      sortOrder: destination.order,
      status: 'PUBLISHED' as const,
      publishedAt: now,
      metaDescription: destination.blurb,
    };

    const row = await db.destination.upsert({
      where: { slug: destination.slug },
      create: { slug: destination.slug, ...base },
      update: base,
    });
    ids.set(destination.slug, row.id);
  }

  console.log(`  destinations ${destinations.length}`);
  return ids;
}

/**
 * Which journeys go where, in both orders.
 *
 * The obvious source is `destination.tripSlugs` — every destination already
 * lists the journeys that visit it. Using it produces the right set of links
 * and the wrong order: a journey's region line reads "Paro · Bumthang ·
 * Trongsa", which is the order the route passes through them, and iterating
 * destinations produces the order the *destinations* happen to be listed in.
 * The first run of this seed put Trongsa before Paro on the sacred-valleys
 * journey, which is backwards along the only road there is.
 *
 * So the order comes from `trip.regions`, which the design maintained by hand
 * for exactly this reason, matched to destinations by name. Anything a journey
 * visits that its region line does not name is appended afterwards, in
 * catalogue order, so a link is never silently dropped.
 */
async function linkTripsToDestinations(
  tripIds: Map<string, string>,
  destinationIds: Map<string, string>,
): Promise<void> {
  const byName = new Map<string, string>();
  for (const destination of destinations as DestinationJson[]) {
    const id = destinationIds.get(destination.slug);
    if (id) byName.set(destination.name.toLowerCase(), id);
  }

  /* destinationId → the journeys that list it, for the append pass. */
  const visits = new Map<string, Set<string>>();
  for (const destination of destinations as DestinationJson[]) {
    const id = destinationIds.get(destination.slug);
    if (!id) continue;
    for (const slug of destination.tripSlugs) {
      const tripId = tripIds.get(slug);
      if (!tripId) continue;
      const set = visits.get(tripId) ?? new Set<string>();
      set.add(id);
      visits.set(tripId, set);
    }
  }

  let unmatched = 0;

  for (const trip of trips as TripJson[]) {
    const tripId = tripIds.get(trip.slug);
    if (!tripId) continue;

    await db.tripOnDestination.deleteMany({ where: { tripId } });

    const ordered: string[] = [];
    for (const region of trip.regions) {
      const id = byName.get(region.toLowerCase());
      if (!id) {
        /* A region line naming somewhere that is not a destination row.
           Jomolhari is the real case: a mountain, the whole point of that
           route, and not one of the six valleys on /destinations. The line
           keeps it — `Trip.regions` is the editorial answer — and there is
           simply no cross-link for it, which is correct. */
        unmatched += 1;
        continue;
      }
      if (!ordered.includes(id)) ordered.push(id);
    }

    for (const id of visits.get(tripId) ?? []) {
      if (!ordered.includes(id)) ordered.push(id);
    }

    if (ordered.length > 0) {
      await db.tripOnDestination.createMany({
        data: ordered.map((destinationId, index) => ({
          tripId,
          destinationId,
          routeOrder: index,
          /* Null until the pass below says the destination offers it. */
          offerOrder: null,
        })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * The other end of the join: how each destination orders its journeys.
   *
   * From `destination.tripSlugs`, which is where the design kept it — the
   * order the office wants those journeys offered on that place's page, which
   * is an editorial decision and not a consequence of anybody's route.
   */
  for (const destination of destinations as DestinationJson[]) {
    const destinationId = destinationIds.get(destination.slug);
    if (!destinationId) continue;

    for (const [index, slug] of destination.tripSlugs.entries()) {
      const tripId = tripIds.get(slug);
      if (!tripId) continue;
      await db.tripOnDestination
        .update({
          where: { tripId_destinationId: { tripId, destinationId } },
          data: { offerOrder: index },
        })
        /* A journey listed by a destination whose own region line does not
           name that destination has no link to update. Rare, and the
           destination page simply does not offer it — which is the honest
           answer, because the journey does not claim to go there. */
        .catch(() => undefined);
    }
  }

  console.log(
    `  trip→place   route order and offer order${unmatched ? `, ${unmatched} region name(s) have no destination page` : ''}`,
  );
}

async function seedActivities(
  media: (src?: string | null) => string | null,
  tripIds: Map<string, string>,
): Promise<void> {
  for (const activity of activities as ActivityJson[]) {
    const base = {
      name: activity.name,
      blurb: activity.blurb,
      icon: ICON[activity.icon] ?? 'PAVILION',
      imageId: media(activity.image),
      examples: activity.examples,
      sortOrder: activity.order,
      status: 'PUBLISHED' as const,
      publishedAt: now,
      metaDescription: activity.blurb,
    };

    const row = await db.activity.upsert({
      where: { slug: activity.slug },
      create: { slug: activity.slug, ...base },
      update: base,
    });

    await db.activityOnTrip.deleteMany({ where: { activityId: row.id } });
    const links = activity.tripSlugs
      .map((slug, index) => {
        const tripId = tripIds.get(slug);
        return tripId ? { activityId: row.id, tripId, sortOrder: index } : null;
      })
      .filter((link): link is NonNullable<typeof link> => link !== null);
    if (links.length > 0) {
      await db.activityOnTrip.createMany({ data: links, skipDuplicates: true });
    }
  }
  console.log(`  activities   ${activities.length}`);
}

async function seedCulture(media: (src?: string | null) => string | null): Promise<void> {
  for (const article of culture as CultureJson[]) {
    const base = {
      title: article.title,
      body: article.body,
      icon: ICON[article.icon] ?? 'CHORTEN',
      imageId: media(article.image),
      sortOrder: article.order,
      status: 'PUBLISHED' as const,
      publishedAt: now,
      metaDescription: article.body.slice(0, 155),
    };
    await db.cultureArticle.upsert({
      where: { slug: article.slug },
      create: { slug: article.slug, ...base },
      update: base,
    });
  }
  console.log(`  culture      ${culture.length}`);
}

async function seedGallery(media: (src?: string | null) => string | null): Promise<void> {
  let written = 0;
  for (const image of gallery as GalleryJson[]) {
    const mediaId = media(image.src);
    if (!mediaId) continue;

    /* Keyed on the media row rather than on a slug, because a gallery entry is
       a photograph with a caption and has no other identity. */
    const existing = await db.galleryImage.findFirst({ where: { mediaId } });
    if (existing) {
      await db.galleryImage.update({
        where: { id: existing.id },
        data: { caption: image.caption, ratio: image.ratio, sortOrder: image.order },
      });
    } else {
      await db.galleryImage.create({
        data: {
          mediaId,
          caption: image.caption,
          ratio: image.ratio,
          sortOrder: image.order,
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });
    }
    written += 1;
  }
  console.log(`  gallery      ${written}`);
}

async function seedReflections(tripIds: Map<string, string>): Promise<void> {
  for (const reflection of reflections as ReflectionJson[]) {
    const base = {
      quote: reflection.quote,
      name: reflection.name,
      detail: reflection.detail ?? null,
      tripId: reflection.tripSlug ? (tripIds.get(reflection.tripSlug) ?? null) : null,
      featured: reflection.featured,
      sortOrder: reflection.order,
      status: 'PUBLISHED' as const,
      publishedAt: now,
    };

    /**
     * Keyed on the id the design gave it.
     *
     * `penjor-bumthang` is a stable handle the content already used, so
     * carrying it across makes the seed idempotent without inventing a slug
     * column for a quote.
     */
    const existing = await db.reflection.findUnique({ where: { id: reflection.id } });
    if (existing) {
      await db.reflection.update({ where: { id: reflection.id }, data: base });
    } else {
      await db.reflection.create({ data: { id: reflection.id, ...base } });
    }
  }
  console.log(`  reflections  ${reflections.length}`);
}
