import 'server-only';

import type {
  ApiActivity,
  ApiCompany,
  ApiCultureArticle,
  ApiDestination,
  ApiGalleryImage,
  ApiImage,
  ApiNavLink,
  ApiPage,
  ApiPageSection,
  ApiPerson,
  ApiPost,
  ApiPostBlock,
  ApiPostSummary,
  ApiReflection,
  ApiSeason,
  ApiSeo,
  ApiSite,
  ApiSocialLink,
  ApiTrip,
  ApiTripSummary,
  SiteIconName,
} from '@lotuspeak/api-contracts';
import type {
  Activity,
  CultureArticle,
  Destination,
  Difficulty,
  MenuItem,
  Media,
  MediaRendition,
  Prisma,
  SeasonKey,
  SiteIcon,
  TripType,
} from '@prisma/client';

import { db } from '@/lib/db';
import { env } from '@/lib/env';
import {
  mediaIdsIn,
  parsePageSections,
  parsePostBody,
  type StoredPageSection,
  type StoredPostBlock,
} from '@/server/schema/blocks';
import { MEDIA_INCLUDE, serialiseMedia, type MediaWithRenditions } from './media';

/**
 * Prisma rows → the shapes in `@lotuspeak/api-contracts`.
 *
 * The only place in this application that produces what the website reads.
 * Three rules hold throughout:
 *
 * 1. **Published only.** Every query filters on `status: 'PUBLISHED'` and
 *    `deletedAt: null`. The website has no database credential precisely so it
 *    *cannot* see a draft, and a filter missing here would undo that in one
 *    line. Preview is a separate, signed path — see `previewTrip` below.
 * 2. **Nothing is pre-formatted.** Prices are numbers, dates are ISO strings,
 *    altitudes are metres. The design has exact opinions about thin spaces and
 *    middots, and a payload arriving as "US$ 4,500" cannot be sorted.
 * 3. **Photographs are resolved here.** A stored block holds a media id; the
 *    website receives a whole `ApiImage` with its url, dimensions, alt text and
 *    focal point. That resolution happens once, batched, rather than the
 *    website making 40 requests for the images on a journey page.
 */

/**
 * Where the website should resolve a relative media URL against.
 *
 * Only used by the local storage driver, which serves through
 * `/api/storage/...` on *this* app. With S3 the URLs are already absolute and
 * this is never consulted.
 */
function adminOrigin(): string {
  return process.env.ADMIN_PUBLIC_URL?.replace(/\/$/, '') || 'http://localhost:6011';
}

/* -------------------------------------------------------------------------- */
/*  Enum translation                                                           */
/* -------------------------------------------------------------------------- */

const TRIP_TYPE: Record<TripType, ApiTrip['type']> = {
  MINDFULNESS: 'mindfulness',
  MEDITATION: 'meditation',
  FESTIVAL: 'festival',
  TREKKING: 'trekking',
};

const DIFFICULTY: Record<Difficulty, ApiTrip['difficulty']> = {
  GENTLE: 'Gentle',
  MODERATE: 'Moderate',
  DEMANDING: 'Demanding',
};

const SEASON_KEY: Record<SeasonKey, ApiSeason['key']> = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
};

/**
 * The enum, as the design system's icon component names them.
 *
 * `Record<SiteIcon, SiteIconName>` on both sides, so adding a silhouette to
 * either end without the other is a compile error. A wrong name here renders
 * nothing at all — the component switches on it — and nothing is the one
 * failure that looks like a styling problem rather than a data one.
 */
const ICON: Record<SiteIcon, SiteIconName> = {
  DZONG: 'dzong',
  CHORTEN: 'chorten',
  STUPA: 'stupa',
  MONASTERY: 'monastery',
  PAVILION: 'pavilion',
  DZONG_LONG: 'dzong-long',
  BUDDHA: 'buddha',
};

/* -------------------------------------------------------------------------- */
/*  SEO                                                                        */
/* -------------------------------------------------------------------------- */

interface SeoColumns {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterCard: string;
  keywords: string[];
  schemaJson: Prisma.JsonValue | null;
  sitemapPriority: number;
  sitemapChangeFreq: string;
  updatedAt: Date;
}

function serialiseSeo(row: SeoColumns, ogImage: ApiImage | null): ApiSeo {
  return {
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    canonicalUrl: row.canonicalUrl,
    noIndex: row.noIndex,
    noFollow: row.noFollow,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImage,
    twitterCard: row.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
    keywords: row.keywords,
    schemaJson: row.schemaJson ?? null,
    sitemapPriority: row.sitemapPriority,
    sitemapChangeFreq: (row.sitemapChangeFreq as ApiSeo['sitemapChangeFreq']) ?? 'monthly',
    updatedAt: row.updatedAt.toISOString(),
  };
}

const img = (media: MediaWithRenditions | null | undefined): ApiImage | null =>
  serialiseMedia(media, adminOrigin());

/* -------------------------------------------------------------------------- */
/*  The site                                                                   */
/* -------------------------------------------------------------------------- */

const PUBLISHED = { status: 'PUBLISHED' as const, deletedAt: null };

/**
 * The status filter, relaxed for a signed preview.
 *
 * The website's whole safety property is that it holds no database credential
 * and therefore cannot see a draft. Preview is the one hole in that, and this
 * is where the hole is: a caller with a valid, fifteen-minute, path-scoped
 * token gets everything but a deleted row.
 *
 * `deletedAt` is still enforced even in preview. A deleted journey is not a
 * draft — nobody is working on it — and rendering one would be a page with a
 * hero image that has been unlinked.
 */
function visible(preview: boolean) {
  return preview ? { deletedAt: null } : PUBLISHED;
}

/**
 * Everything the root layout needs, in one object.
 *
 * One request rather than five, because the navigation, the footer, the
 * contact line and the default SEO are rendered on *every* page — and four
 * cache entries for one layout is four entries that can disagree about which
 * publish they came from.
 */
export async function getSite(): Promise<ApiSite> {
  const [company, address, contacts, socials, hours, menus, announcement, settings] =
    await Promise.all([
      db.companyProfile.findFirst({
        where: { isSingleton: true },
        include: {
          logo: { include: MEDIA_INCLUDE },
          mark: { include: MEDIA_INCLUDE },
          ogImage: { include: MEDIA_INCLUDE },
        },
      }),
      db.address.findFirst({ where: { isPrimary: true }, orderBy: { sortOrder: 'asc' } }),
      db.contactChannel.findMany({
        where: { isPublic: true },
        orderBy: { sortOrder: 'asc' },
      }),
      db.socialLink.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      db.officeHours.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.menu.findMany({ include: { items: { orderBy: { sortOrder: 'asc' } } } }),
      db.announcement.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } }),
      db.setting.findMany({ where: { group: 'integrations' } }),
    ]);

  if (!company) {
    /**
     * A hard failure, not a default.
     *
     * The website builds every page from this, and a fabricated company would
     * deploy a site with somebody else's name on it. The message says what to
     * run because the only way to reach this state is an unseeded database.
     */
    throw new Error(
      'There is no company profile. Run `npm run db:seed` in apps/admin, or fill in Settings → Company.',
    );
  }

  const header = menus.find((menu) => menu.location === 'HEADER');
  const cta = header?.items.find((item) => item.isCta);

  const footerColumns = (['FOOTER_ONE', 'FOOTER_TWO', 'FOOTER_THREE'] as const)
    .map((location) => menus.find((menu) => menu.location === location))
    .filter((menu): menu is NonNullable<typeof menu> => menu !== undefined)
    .map((menu) => ({
      title: menu.name,
      links: menu.items.filter((item) => !item.parentId).map(toNavLink(menu.items)),
    }));

  const setting = (key: string): string | null => {
    const value = settings.find((row) => row.key === key)?.value;
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  const whatsapp = contacts.find((contact) => contact.kind === 'WHATSAPP');

  const apiCompany: ApiCompany = {
    legalName: company.legalName,
    name: company.name,
    tagline: company.tagline,
    description: company.description,
    foundedYear: company.foundedYear,
    licenceNumber: company.licenceNumber,
    registrationNumber: company.registrationNumber,
    logo: img(company.logo),
    markLogo: img(company.mark),
    address: {
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? null,
      locality: address?.locality ?? '',
      region: address?.region ?? null,
      postalCode: address?.postalCode ?? null,
      country: address?.country ?? 'Bhutan',
      countryCode: address?.countryCode ?? 'BT',
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
      mapUrl: address?.mapUrl ?? null,
    },
    contacts: contacts.map((contact) => ({
      kind: contact.kind,
      label: contact.label,
      value: contact.value,
      display: contact.display,
      isPrimary: contact.isPrimary,
      prefillMessage: contact.prefillMessage,
    })),
    socials: socials.map(
      (social): ApiSocialLink => ({
        platform: social.platform,
        label: social.label,
        handle: social.handle,
        url: social.url,
      }),
    ),
    officeHours: hours.map((row) => ({
      dayFrom: row.dayFrom,
      dayTo: row.dayTo,
      opens: row.opens,
      closes: row.closes,
      closed: row.closed,
    })),
  };

  return {
    company: apiCompany,
    nav: (header?.items ?? [])
      .filter((item) => !item.parentId && !item.isCta)
      .map(toNavLink(header?.items ?? [])),
    navCta: cta ? { label: cta.label, href: cta.href } : null,
    footer: {
      columns: footerColumns,
      note: company.footerNote,
      copyright: company.footerCopyright,
    },
    replyPromise: company.replyPromise,
    pledge:
      company.pledgePercent && company.pledgeBeneficiary
        ? {
            percent: company.pledgePercent,
            beneficiary: company.pledgeBeneficiary,
            note: company.pledgeNote,
          }
        : null,
    sdfPerNightUsd: company.sdfPerNightUsd,
    defaultSeo: {
      titleTemplate: company.seoTitleTemplate,
      defaultTitle: company.seoDefaultTitle,
      description: company.seoDescription,
      ogImage: img(company.ogImage),
    },
    siteUrl: company.siteUrl.replace(/\/$/, ''),
    integrations: {
      googleAnalyticsId: setting('googleAnalyticsId'),
      googleTagManagerId: setting('googleTagManagerId'),
      googleSiteVerification: setting('googleSiteVerification'),
      metaPixelId: setting('metaPixelId'),
      whatsappNumber: whatsapp?.value ?? null,
      whatsappPrefill: whatsapp?.prefillMessage ?? null,
      tripadvisorWidgetId: setting('tripadvisorWidgetId'),
    },
    announcement: announcement
      ? {
          message: announcement.message,
          href: announcement.href,
          linkLabel: announcement.linkLabel,
        }
      : null,
  };
}

/** Builds one level of the menu tree, with its children beneath it. */
function toNavLink(all: MenuItem[]) {
  return function build(item: MenuItem): ApiNavLink {
    return {
      label: item.label,
      href: item.href,
      external: item.isExternal,
      children: all
        .filter((child) => child.parentId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(build),
    };
  };
}

/* -------------------------------------------------------------------------- */
/*  Journeys                                                                   */
/* -------------------------------------------------------------------------- */

const TRIP_INCLUDE = {
  hero: { include: MEDIA_INCLUDE },
  ogImage: { include: MEDIA_INCLUDE },
  highlights: { orderBy: { sortOrder: 'asc' } },
  inclusions: { orderBy: { sortOrder: 'asc' } },
  faqs: { orderBy: { sortOrder: 'asc' } },
  itinerary: {
    orderBy: { sortOrder: 'asc' },
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
        include: { media: { include: MEDIA_INCLUDE } },
      },
    },
  },
  gallery: {
    orderBy: { sortOrder: 'asc' },
    include: { media: { include: MEDIA_INCLUDE } },
  },
  destinations: {
    orderBy: { routeOrder: 'asc' },
    include: { destination: { select: { slug: true, name: true } } },
  },
  departures: {
    where: { isPublished: true, startDate: { gte: new Date() } },
    orderBy: { startDate: 'asc' },
  },
  relatedFrom: {
    orderBy: { sortOrder: 'asc' },
    include: { target: { select: { slug: true } } },
  },
} satisfies Prisma.TripInclude;

export async function listTrips(options?: {
  type?: ApiTrip['type'];
  limit?: number;
}): Promise<ApiTripSummary[]> {
  const rows = await db.trip.findMany({
    where: {
      ...PUBLISHED,
      ...(options?.type
        ? { type: Object.entries(TRIP_TYPE).find(([, v]) => v === options.type)?.[0] as TripType }
        : {}),
    },
    orderBy: { sortOrder: 'asc' },
    take: options?.limit,
    include: { hero: { include: MEDIA_INCLUDE } },
  });

  return rows.map((trip) => ({
    slug: trip.slug,
    title: trip.title,
    excerpt: trip.excerpt,
    type: TRIP_TYPE[trip.type],
    /* The editorial line, not the join. See `Trip.regions` in the schema for
       why they are two different things. */
    regions: trip.regions,
    durationDays: trip.durationDays,
    nights: trip.nights,
    highPointMetres: trip.highPointMetres,
    difficulty: DIFFICULTY[trip.difficulty],
    priceFromUsd: trip.priceFromUsd,
    seasonLabel: trip.seasonLabel,
    journeyLabel: trip.journeyLabel,
    heroImage: img(trip.hero),
    featured: trip.featured,
  }));
}

export async function getTrip(
  slug: string,
  options?: { preview?: boolean },
): Promise<ApiTrip | null> {
  const trip = await db.trip.findFirst({
    where: { slug, ...visible(options?.preview === true) },
    include: TRIP_INCLUDE,
  });
  return trip ? serialiseTrip(trip) : null;
}

type TripRow = Prisma.TripGetPayload<{ include: typeof TRIP_INCLUDE }>;

function serialiseTrip(trip: TripRow): ApiTrip {
  return {
    slug: trip.slug,
    title: trip.title,
    excerpt: trip.excerpt,
    type: TRIP_TYPE[trip.type],
    regions: trip.regions,
    destinationSlugs: trip.destinations.map((link) => link.destination.slug),
    durationDays: trip.durationDays,
    nights: trip.nights,
    highPointMetres: trip.highPointMetres,
    difficulty: DIFFICULTY[trip.difficulty],
    priceFromUsd: trip.priceFromUsd,
    seasonLabel: trip.seasonLabel,
    seasonKeys: trip.seasonKeys.map((key) => SEASON_KEY[key]),
    paceNote: trip.paceNote,
    journeyLabel: trip.journeyLabel,
    groupSizeMin: trip.groupSizeMin,
    groupSizeMax: trip.groupSizeMax,
    heroImage: img(trip.hero),
    overview: trip.overview,
    highlights: trip.highlights.map((row) => row.text),
    itinerary: numberItinerary(trip.itinerary),
    included: trip.inclusions.filter((row) => row.isIncluded).map((row) => row.text),
    excluded: trip.inclusions.filter((row) => !row.isIncluded).map((row) => row.text),
    faq: trip.faqs.map((row) => ({ question: row.question, answer: row.answer })),
    gallery: trip.gallery
      .map((item) => {
        const image = img(item.media);
        return image ? { image, ratio: item.ratio, width: item.width } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    departures: trip.departures.map((row) => ({
      id: row.id,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      priceUsd: row.priceUsd,
      placesTotal: row.placesTotal,
      placesLeft: row.placesLeft,
      status: row.status,
      note: row.note,
    })),
    relatedSlugs: trip.relatedFrom.map((link) => link.target.slug),
    featured: trip.featured,
    seo: serialiseSeo(trip, img(trip.ogImage)),
  };
}

/**
 * Numbers the itinerary.
 *
 * Computed from position rather than stored, because an itinerary with an
 * arrival day inserted at the front is an itinerary where every stored number
 * after it is wrong.
 *
 * **A rest day takes a number; it just does not print one.** The Jomolhari
 * trek is the proof: a rest day at Jangothang sits at position six, and the
 * walk to Lingshi after it is Day 7. Counting only the days that print a
 * number would call it Day 6 — and a fourteen-day itinerary would end on Day
 * 12, which is not what the traveller's calendar says. These are dates on a
 * journey, not entries in a list.
 *
 * This is also the one piece of derived data the website is not allowed to
 * derive for itself: the admin panel's editor shows live numbers as the office
 * drags days around, and both have to count the same way or the preview lies.
 */
function numberItinerary(days: TripRow['itinerary']): ApiTrip['itinerary'] {
  return days.map((day, index) => {
    return {
      day: day.isRest ? null : index + 1,
      rest: day.isRest,
      title: day.title,
      meta: day.meta,
      body: day.body,
      images: day.images
        .map((row) => img(row.media))
        .filter((image): image is ApiImage => image !== null),
    };
  });
}

export async function tripSlugs(): Promise<string[]> {
  const rows = await db.trip.findMany({
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' },
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}

/* -------------------------------------------------------------------------- */
/*  Journal                                                                    */
/* -------------------------------------------------------------------------- */

export async function listPosts(options?: {
  limit?: number;
  exclude?: string;
}): Promise<ApiPostSummary[]> {
  const rows = await db.post.findMany({
    where: {
      ...PUBLISHED,
      ...(options?.exclude ? { slug: { not: options.exclude } } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    take: options?.limit,
    include: { hero: { include: MEDIA_INCLUDE } },
  });

  return rows.map((post) => ({
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    date: (post.publishedAt ?? post.createdAt).toISOString(),
    region: post.region,
    heroImage: img(post.hero),
    readingMinutes: post.readingMinutes,
  }));
}

export async function getPost(
  slug: string,
  options?: { preview?: boolean },
): Promise<ApiPost | null> {
  const post = await db.post.findFirst({
    where: { slug, ...visible(options?.preview === true) },
    include: {
      hero: { include: MEDIA_INCLUDE },
      ogImage: { include: MEDIA_INCLUDE },
      author: {
        select: { name: true, jobTitle: true, avatar: { include: MEDIA_INCLUDE } },
      },
      tripLinks: { orderBy: { sortOrder: 'asc' }, include: { trip: { select: { slug: true } } } },
    },
  });
  if (!post) return null;

  const stored = parsePostBody(post.body, `post:${post.slug}`);
  const images = await resolveMedia(mediaIdsIn(stored));

  return {
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    date: (post.publishedAt ?? post.createdAt).toISOString(),
    region: post.region,
    heroImage: img(post.hero),
    body: serialiseBody(stored, images),
    author: post.author
      ? {
          name: post.author.name,
          role: post.author.jobTitle,
          avatar: img(post.author.avatar),
        }
      : null,
    tags: post.tags,
    relatedTripSlugs: post.tripLinks.map((link) => link.trip.slug),
    readingMinutes: post.readingMinutes,
    seo: serialiseSeo(post, img(post.ogImage)),
  };
}

export async function postSlugs(): Promise<string[]> {
  const rows = await db.post.findMany({
    where: PUBLISHED,
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}

/**
 * Stored blocks → sent blocks.
 *
 * An image block whose photograph has since been deleted is **dropped**, not
 * sent with a null image. The alternative is every renderer downstream having
 * to handle an image block with no image — a nullable field introduced by a
 * deletion that happened once.
 */
function serialiseBody(
  blocks: StoredPostBlock[],
  images: Map<string, ApiImage>,
): ApiPostBlock[] {
  const out: ApiPostBlock[] = [];
  for (const block of blocks) {
    if (block.kind === 'image') {
      const image = images.get(block.mediaId);
      if (image) out.push({ kind: 'image', image, ratio: block.ratio });
      continue;
    }
    out.push(block);
  }
  return out;
}

/** One query for every photograph a body or a page refers to. */
async function resolveMedia(ids: string[]): Promise<Map<string, ApiImage>> {
  if (ids.length === 0) return new Map();
  const rows = await db.media.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: MEDIA_INCLUDE,
  });
  const map = new Map<string, ApiImage>();
  for (const row of rows) {
    const image = img(row);
    if (image) map.set(row.id, image);
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/*  Places, activities, seasons, culture, gallery, reflections                 */
/* -------------------------------------------------------------------------- */

export async function listDestinations(): Promise<ApiDestination[]> {
  const rows = await db.destination.findMany({
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' },
    include: {
      image: { include: MEDIA_INCLUDE },
      ogImage: { include: MEDIA_INCLUDE },
      trips: {
        /* The destination's own order, not the route's, and only the journeys
           it actually offers — a null `offerOrder` is a route that passes
           through. See `TripOnDestination` in the schema. */
        where: { offerOrder: { not: null } },
        orderBy: { offerOrder: 'asc' },
        include: { trip: { select: { slug: true, status: true, deletedAt: true } } },
      },
    },
  });

  return rows.map((row) => serialiseDestination(row));
}

type DestinationRow = Destination & {
  image: MediaWithRenditions | null;
  ogImage: MediaWithRenditions | null;
  trips: { trip: { slug: string; status: string; deletedAt: Date | null } }[];
};

function serialiseDestination(row: DestinationRow): ApiDestination {
  return {
    slug: row.slug,
    name: row.name,
    icon: ICON[row.icon],
    blurb: row.blurb,
    detail: row.detail,
    image: img(row.image),
    /* Unpublished journeys are filtered out here rather than in the query,
       because the join is already loaded and a second `where` on a nested
       relation is a second round trip for six rows. */
    tripSlugs: row.trips
      .filter((link) => link.trip.status === 'PUBLISHED' && !link.trip.deletedAt)
      .map((link) => link.trip.slug),
    altitudeMetres: row.altitudeMetres,
    latitude: row.latitude,
    longitude: row.longitude,
    seo: serialiseSeo(row, img(row.ogImage)),
  };
}

export async function listActivities(): Promise<ApiActivity[]> {
  const rows = await db.activity.findMany({
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' },
    include: {
      image: { include: MEDIA_INCLUDE },
      ogImage: { include: MEDIA_INCLUDE },
      trips: {
        orderBy: { sortOrder: 'asc' },
        include: { trip: { select: { slug: true, status: true, deletedAt: true } } },
      },
    },
  });

  return rows.map(
    (row): ApiActivity => ({
      slug: row.slug,
      name: row.name,
      blurb: row.blurb,
      icon: ICON[row.icon],
      image: img(row.image),
      examples: row.examples,
      tripSlugs: row.trips
        .filter((link) => link.trip.status === 'PUBLISHED' && !link.trip.deletedAt)
        .map((link) => link.trip.slug),
      seo: serialiseSeo(row, img(row.ogImage)),
    }),
  );
}

export async function listSeasons(): Promise<ApiSeason[]> {
  const rows = await db.season.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { image: { include: MEDIA_INCLUDE } },
  });

  return rows.map((row) => ({
    key: SEASON_KEY[row.key],
    monthsLabel: row.monthsLabel,
    name: row.name,
    headline: row.headline,
    summary: row.summary,
    detail: row.detail,
    image: img(row.image),
  }));
}

export async function listCulture(): Promise<ApiCultureArticle[]> {
  const rows = await db.cultureArticle.findMany({
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' },
    include: {
      image: { include: MEDIA_INCLUDE },
      ogImage: { include: MEDIA_INCLUDE },
    },
  });

  return rows.map(
    (row): ApiCultureArticle => ({
      slug: row.slug,
      title: row.title,
      body: row.body,
      icon: ICON[row.icon],
      image: img(row.image),
      seo: serialiseSeo(row, img(row.ogImage)),
    }),
  );
}

export async function listGallery(options?: { limit?: number }): Promise<ApiGalleryImage[]> {
  const rows = await db.galleryImage.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { sortOrder: 'asc' },
    take: options?.limit,
    include: { media: { include: MEDIA_INCLUDE } },
  });

  return rows
    .map((row) => {
      const image = img(row.media);
      return image ? { image, caption: row.caption, ratio: row.ratio ?? '3/2' } : null;
    })
    .filter((row): row is ApiGalleryImage => row !== null);
}

export async function listReflections(options?: {
  tripSlug?: string;
  featured?: boolean;
  limit?: number;
}): Promise<ApiReflection[]> {
  const rows = await db.reflection.findMany({
    where: {
      status: 'PUBLISHED',
      ...(options?.featured !== undefined ? { featured: options.featured } : {}),
      ...(options?.tripSlug ? { trip: { slug: options.tripSlug } } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    take: options?.limit,
    include: { trip: { select: { slug: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    quote: row.quote,
    name: row.name,
    detail: row.detail,
    tripSlug: row.trip?.slug ?? null,
    featured: row.featured,
  }));
}

export async function listPeople(): Promise<ApiPerson[]> {
  const rows = await db.person.findMany({
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' },
    include: { photo: { include: MEDIA_INCLUDE } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photo: img(row.photo),
    languages: row.languages,
    socials: Array.isArray(row.socials) ? (row.socials as unknown as ApiSocialLink[]) : [],
  }));
}

/* -------------------------------------------------------------------------- */
/*  Pages                                                                      */
/* -------------------------------------------------------------------------- */

export async function getPage(
  path: string,
  options?: { preview?: boolean },
): Promise<ApiPage | null> {
  const page = await db.page.findFirst({
    where: { path, ...visible(options?.preview === true) },
    include: {
      hero: { include: MEDIA_INCLUDE },
      ogImage: { include: MEDIA_INCLUDE },
    },
  });
  if (!page) return null;

  const stored = parsePageSections(page.sections, `page:${page.path}`);
  const images = await resolveMedia(mediaIdsIn(stored));

  return {
    slug: page.slug,
    path: page.path,
    title: page.title,
    eyebrow: page.eyebrow,
    lead: page.lead,
    heroImage: img(page.hero),
    sections: serialiseSections(stored, images),
    seo: serialiseSeo(page, img(page.ogImage)),
  };
}

export async function listPages(): Promise<Pick<ApiPage, 'path' | 'title' | 'lead'>[]> {
  const rows = await db.page.findMany({
    where: { ...PUBLISHED, showInSitemap: true },
    orderBy: { sortOrder: 'asc' },
    select: { path: true, title: true, lead: true },
  });
  return rows;
}

function serialiseSections(
  sections: StoredPageSection[],
  images: Map<string, ApiImage>,
): ApiPageSection[] {
  const out: ApiPageSection[] = [];

  for (const section of sections) {
    if (section.kind === 'figure') {
      const image = images.get(section.mediaId);
      if (image) {
        out.push({
          kind: 'figure',
          image,
          caption: section.caption,
          width: section.width,
        });
      }
      continue;
    }

    if (section.kind === 'gallery') {
      const items = section.items
        .map((item) => {
          const image = images.get(item.mediaId);
          return image ? { image, ratio: item.ratio, width: item.width } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      /* A gallery band with every photograph deleted is a heading above a
         hole. Dropping the whole section is the honest render. */
      if (items.length > 0) out.push({ kind: 'gallery', title: section.title, items });
      continue;
    }

    if (section.kind === 'points') {
      out.push({
        kind: 'points',
        eyebrow: section.eyebrow,
        title: section.title,
        lead: section.lead,
        points: section.points.map((point) => ({
          title: point.title,
          body: point.body,
          icon: point.icon as SiteIconName | null,
        })),
      });
      continue;
    }

    out.push(section as ApiPageSection);
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Discovery                                                                  */
/* -------------------------------------------------------------------------- */

export async function getSitemap() {
  const [trips, posts, pages, destinations] = await Promise.all([
    db.trip.findMany({
      where: { ...PUBLISHED, noIndex: false },
      select: { slug: true, updatedAt: true, sitemapPriority: true, sitemapChangeFreq: true },
    }),
    db.post.findMany({
      where: { ...PUBLISHED, noIndex: false },
      select: { slug: true, updatedAt: true, sitemapPriority: true, sitemapChangeFreq: true },
    }),
    db.page.findMany({
      where: { ...PUBLISHED, noIndex: false, showInSitemap: true },
      select: { path: true, updatedAt: true, sitemapPriority: true, sitemapChangeFreq: true },
    }),
    db.destination.findMany({
      where: { ...PUBLISHED, noIndex: false },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const entries = [
    ...pages.map((page) => ({
      path: page.path,
      lastModified: page.updatedAt.toISOString(),
      changeFrequency: page.sitemapChangeFreq as ApiSeo['sitemapChangeFreq'],
      priority: page.sitemapPriority,
    })),
    ...trips.map((trip) => ({
      path: `/trips/${trip.slug}`,
      lastModified: trip.updatedAt.toISOString(),
      changeFrequency: trip.sitemapChangeFreq as ApiSeo['sitemapChangeFreq'],
      priority: trip.sitemapPriority,
    })),
    ...posts.map((post) => ({
      path: `/journal/${post.slug}`,
      lastModified: post.updatedAt.toISOString(),
      changeFrequency: post.sitemapChangeFreq as ApiSeo['sitemapChangeFreq'],
      priority: post.sitemapPriority,
    })),
  ];

  /* Destinations render as anchors on one page rather than as pages of their
     own, so they contribute their freshness to that page and not entries of
     their own — a sitemap listing six URLs that all resolve to the same
     document is six ways to say one thing. */
  void destinations;

  return entries.sort((a, b) => b.priority - a.priority);
}

export async function listRedirects() {
  const rows = await db.redirect.findMany({
    where: { isActive: true },
    select: { source: true, target: true, type: true },
  });
  return rows.map((row) => ({
    source: row.source,
    target: row.target,
    permanent: row.type === 'MOVED_301',
  }));
}
