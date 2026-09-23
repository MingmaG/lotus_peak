import 'server-only';

import type {
  ApiActivity,
  ApiCompany,
  ApiCultureArticle,
  ApiCultureSummary,
  ApiDestination,
  ApiDestinationSummary,
  ApiGalleryImage,
  ApiImage,
  ApiNavLink,
  ApiPage,
  ApiPageSection,
  ApiPerson,
  ApiPost,
  ApiPostSummary,
  ApiReflection,
  ApiSeason,
  ApiSeo,
  ApiSite,
  ApiSocialLink,
  ApiTrip,
  ApiTripSummary,
  JournalCategory,
  SiteIconName,
} from '@lotuspeak/api-contracts';
import type {
  Difficulty,
  MenuItem,
  Prisma,
  SeasonKey,
  SiteIcon,
  Trip,
  TripType,
} from '@prisma/client';

import { parseElevationProfile, parseTripStats } from '@/server/schema/blocks';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import {
  mediaIdsIn,
  parsePageSections,
  type StoredPageSection,
} from '@/server/schema/blocks';
import {
  resolveRichTextMedia,
  richTextMediaIds,
  type FigureMedia,
} from '@/server/schema/rich-text';
import { MEDIA_INCLUDE, serialiseMedia, type MediaWithRenditions } from './media';
import {
  CATEGORY_FROM_WIRE,
  CATEGORY_TO_WIRE,
  culturePath,
  destinationPath,
  postPath,
} from './content-paths';

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
  return env.storage.adminPublicUrl;
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
    }))
    /* An emptied column is how the office takes one away; a heading over
       nothing is not a column. */
    .filter((column) => column.links.length > 0);

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
      credit: company.footerCreditName
        ? {
            label: company.footerCreditLabel,
            name: company.footerCreditName,
            url: company.footerCreditUrl || null,
          }
        : null,
      show: {
        links: company.footerShowLinks,
        address: company.footerShowAddress,
        contacts: company.footerShowContacts,
        socials: company.footerShowSocials,
      },
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
  routeMap: { include: MEDIA_INCLUDE },
  ogImage: { include: MEDIA_INCLUDE },
  highlights: { orderBy: { sortOrder: 'asc' } },
  inclusions: { orderBy: { sortOrder: 'asc' } },
  faqs: { orderBy: { sortOrder: 'asc' } },
  faqGroups: {
    orderBy: { sortOrder: 'asc' },
    include: { faqs: { orderBy: { sortOrder: 'asc' } } },
  },
  pricingTiers: { orderBy: { sortOrder: 'asc' } },
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
  relatedFrom: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.TripInclude;

export async function listTrips(options?: {
  type?: ApiTrip['type'];
  featured?: boolean;
  limit?: number;
}): Promise<ApiTripSummary[]> {
  const rows = await db.trip.findMany({
    where: {
      ...PUBLISHED,
      ...(options?.featured !== undefined ? { featured: options.featured } : {}),
      ...(options?.type
        ? { type: Object.entries(TRIP_TYPE).find(([, v]) => v === options.type)?.[0] as TripType }
        : {}),
    },
    orderBy: { sortOrder: 'asc' },
    take: options?.limit,
    include: { hero: { include: MEDIA_INCLUDE } },
  });

  return rows.map(serialiseTripSummary);
}

function serialiseTripSummary(
  trip: Trip & { hero: MediaWithRenditions | null },
): ApiTripSummary {
  return {
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
  };
}

export async function getTrip(
  slug: string,
  options?: { preview?: boolean },
): Promise<ApiTrip | null> {
  const trip = await db.trip.findFirst({
    where: { slug, ...visible(options?.preview === true) },
    include: TRIP_INCLUDE,
  });
  if (!trip) return null;

  const [destinations, culture, posts, related] = await Promise.all([
    tripDestinations(trip),
    trip.showCulture ? tripCulture(trip) : [],
    trip.showJournal ? tripPosts(trip) : [],
    trip.showRelated ? tripRelated(trip) : [],
  ]);

  return { ...serialiseTrip(trip), destinations, culture, posts, related };
}

/** How many cards a band at the foot of a journey offers when the office chose none. */
const FALLBACK_CARDS = 3;

/**
 * The places on the route that have a page, in route order.
 *
 * Always read, whatever `showDestinations` says: the culture and journal
 * fallbacks below are both "what is linked to the route", and they need the
 * ids whether or not the places draw as cards.
 */
async function tripDestinations(trip: TripRow): Promise<ApiDestinationSummary[]> {
  const ids = trip.destinations.map((link) => link.destinationId);
  if (ids.length === 0) return [];
  const rows = await db.destination.findMany({
    where: { id: { in: ids }, ...PUBLISHED_DESTINATION },
    include: DESTINATION_SUMMARY_INCLUDE,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map(serialiseDestinationSummary);
}

/**
 * The culture a journey offers.
 *
 * What the office chose, in its order. Otherwise what is linked to the places
 * on the route — and to the places inside a valley on it, as a valley's own
 * page does, because Punakha's route passes Punakha Dzong whether or not the
 * office listed the dzong as a stop.
 */
async function tripCulture(trip: TripRow): Promise<ApiCultureSummary[]> {
  const chosen = await db.cultureOnTrip.findMany({
    where: { tripId: trip.id, culture: PUBLISHED },
    orderBy: { sortOrder: 'asc' },
    include: { culture: { include: { image: { include: MEDIA_INCLUDE } } } },
  });
  if (chosen.length > 0) return chosen.map((link) => serialiseCultureSummary(link.culture));

  const route = trip.destinations.map((link) => link.destinationId);
  if (route.length === 0) return [];
  const links = await db.cultureOnDestination.findMany({
    where: {
      culture: PUBLISHED,
      OR: [{ destinationId: { in: route } }, { destination: { parentId: { in: route } } }],
    },
    orderBy: { sortOrder: 'asc' },
    include: { culture: { include: { image: { include: MEDIA_INCLUDE } } } },
  });
  const seen = new Set<string>();
  return links
    .map((link) => link.culture)
    .filter((article) => (seen.has(article.id) ? false : (seen.add(article.id), true)))
    .slice(0, FALLBACK_CARDS)
    .map(serialiseCultureSummary);
}

/**
 * Journal entries for a journey.
 *
 * The entries linked to it — the same join the entry's own "Journeys" field
 * writes, so linking from either side shows on both. Otherwise the newest
 * entries about the places on its route.
 */
async function tripPosts(trip: TripRow): Promise<ApiPostSummary[]> {
  const linked = await postsAbout({ tripLinks: { some: { tripId: trip.id } } }, 6);
  if (linked.length > 0) return linked;

  const route = trip.destinations.map((link) => link.destinationId);
  if (route.length === 0) return [];
  return postsAbout(
    {
      destinations: {
        some: {
          OR: [{ destinationId: { in: route } }, { destination: { parentId: { in: route } } }],
        },
      },
    },
    FALLBACK_CARDS,
  );
}

/**
 * Other journeys to offer.
 *
 * The office's choice, in its order and published only. Otherwise the ones
 * after this in catalogue order, wrapping round to the start — which is what
 * the editor has always promised under the picker.
 */
async function tripRelated(trip: TripRow): Promise<ApiTripSummary[]> {
  const chosen = trip.relatedFrom.map((link) => link.targetId);
  if (chosen.length > 0) {
    const rows = await db.trip.findMany({
      where: { id: { in: chosen }, ...PUBLISHED },
      include: { hero: { include: MEDIA_INCLUDE } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return chosen
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .map(serialiseTripSummary);
  }

  const catalogue = await db.trip.findMany({
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' },
    include: { hero: { include: MEDIA_INCLUDE } },
  });
  const at = catalogue.findIndex((row) => row.id === trip.id);
  const others = [...catalogue.slice(at + 1), ...catalogue.slice(0, Math.max(at, 0))].filter(
    (row) => row.id !== trip.id,
  );
  return others.slice(0, FALLBACK_CARDS).map(serialiseTripSummary);
}

type TripRow = Prisma.TripGetPayload<{ include: typeof TRIP_INCLUDE }>;

/** Everything but the bands `getTrip` reads with queries of their own. */
function serialiseTrip(
  trip: TripRow,
): Omit<ApiTrip, 'destinations' | 'culture' | 'posts' | 'related'> {
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
    priceCurrency: trip.priceCurrency,
    priceNote: trip.priceNote,
    pricingTiers: trip.pricingTiers.map((tier) => ({
      label: tier.label,
      minPeople: tier.minPeople,
      maxPeople: tier.maxPeople,
      priceUsd: tier.priceUsd,
      wasPriceUsd: tier.wasPriceUsd,
      note: tier.note,
    })),
    seasonLabel: trip.seasonLabel,
    seasonKeys: trip.seasonKeys.map((key) => SEASON_KEY[key]),
    paceNote: trip.paceNote,
    journeyLabel: trip.journeyLabel,
    groupSizeMin: trip.groupSizeMin,
    groupSizeMax: trip.groupSizeMax,
    heroImage: img(trip.hero),
    routeMap: img(trip.routeMap),
    videoUrl: trip.videoUrl,
    overview: trip.overview,
    stats: parseTripStats(trip.stats, `trip ${trip.slug}`),
    elevationProfile: parseElevationProfile(trip.elevationProfile, `trip ${trip.slug}`),
    highlights: trip.highlights.map((row) => row.text),
    itinerary: numberItinerary(trip.itinerary),
    included: trip.inclusions.filter((row) => row.isIncluded).map((row) => row.text),
    excluded: trip.inclusions.filter((row) => !row.isIncluded).map((row) => row.text),
    /**
     * The ungrouped questions, and then the groups.
     *
     * Split here rather than on the page, because the page draws them
     * differently — the ungrouped ones have no heading above them at all — and
     * a renderer that has to filter a flat list by a null field is one that
     * will eventually forget to.
     */
    faq: trip.faqs
      .filter((row) => row.groupId === null)
      .map((row) => ({ question: row.question, answer: row.answer })),
    faqGroups: trip.faqGroups
      .filter((group) => group.faqs.length > 0)
      .map((group) => ({
        title: group.title,
        blurb: group.blurb,
        items: group.faqs.map((row) => ({ question: row.question, answer: row.answer })),
      })),
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
      isFixed: row.isFixed,
      wasPriceUsd: row.wasPriceUsd,
    })),
    sections: {
      gallery: trip.showGallery,
      destinations: trip.showDestinations,
      culture: trip.showCulture,
      journal: trip.showJournal,
      related: trip.showRelated,
    },
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

/**
 * What a card needs to link to an entry, and the places on the line above it.
 *
 * Only the places that are themselves published. An entry about a place the
 * office has hidden would otherwise print a link that 404s.
 */
const POST_SUMMARY_INCLUDE = {
  hero: { include: MEDIA_INCLUDE },
  destinations: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      destination: {
        select: {
          slug: true,
          name: true,
          status: true,
          deletedAt: true,
          parent: { select: { slug: true, status: true, deletedAt: true } },
        },
      },
    },
  },
} satisfies Prisma.PostInclude;

type PostSummaryRow = Prisma.PostGetPayload<{ include: typeof POST_SUMMARY_INCLUDE }>;

function serialisePostSummary(post: PostSummaryRow): ApiPostSummary {
  return {
    slug: post.slug,
    title: post.title,
    path: postPath(post.slug),
    standfirst: post.standfirst,
    date: (post.publishedAt ?? post.createdAt).toISOString(),
    category: CATEGORY_TO_WIRE[post.category],
    places: post.destinations
      .map((link) => link.destination)
      .filter((d) => isLive(d) && (!d.parent || isLive(d.parent)))
      .map((d) => ({ slug: d.slug, title: d.name, path: destinationPath(d.slug, d.parent?.slug) })),
    heroImage: img(post.hero),
    readingMinutes: post.readingMinutes,
  };
}

function isLive(row: { status: string; deletedAt: Date | null }): boolean {
  return row.status === 'PUBLISHED' && row.deletedAt === null;
}

export async function listPosts(options?: {
  limit?: number;
  exclude?: string;
  category?: JournalCategory;
}): Promise<ApiPostSummary[]> {
  const rows = await db.post.findMany({
    where: {
      ...PUBLISHED,
      ...(options?.exclude ? { slug: { not: options.exclude } } : {}),
      ...(options?.category ? { category: CATEGORY_FROM_WIRE[options.category] } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    take: options?.limit,
    include: POST_SUMMARY_INCLUDE,
  });

  return rows.map(serialisePostSummary);
}

/** Published entries linked to any of these rows, newest first. */
async function postsAbout(
  where: Prisma.PostWhereInput,
  limit = 6,
): Promise<ApiPostSummary[]> {
  const rows = await db.post.findMany({
    where: { ...PUBLISHED, ...where },
    orderBy: [{ publishedAt: 'desc' }],
    take: limit,
    include: POST_SUMMARY_INCLUDE,
  });
  return rows.map(serialisePostSummary);
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
      destinations: {
        orderBy: { sortOrder: 'asc' },
        where: { destination: PUBLISHED_DESTINATION },
        include: { destination: { include: DESTINATION_SUMMARY_INCLUDE } },
      },
      culture: {
        orderBy: { sortOrder: 'asc' },
        where: { culture: PUBLISHED },
        include: { culture: { include: { image: { include: MEDIA_INCLUDE } } } },
      },
    },
  });
  if (!post) return null;

  /* The figures in the body name media ids; the URL and the fallback
     description are filled in from the rows here, which is what keeps a
     photograph's one description in one place. */
  const body = resolveRichTextMedia(post.body, await resolveFigureMedia(post.body));

  return {
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    date: (post.publishedAt ?? post.createdAt).toISOString(),
    category: CATEGORY_TO_WIRE[post.category],
    heroImage: img(post.hero),
    body,
    author: post.author
      ? {
          name: post.author.name,
          role: post.author.jobTitle,
          avatar: img(post.author.avatar),
        }
      : null,
    tags: post.tags,
    relatedTripSlugs: post.tripLinks.map((link) => link.trip.slug),
    destinations: post.destinations.map((link) => serialiseDestinationSummary(link.destination)),
    culture: post.culture.map((link) => serialiseCultureSummary(link.culture)),
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
 * The photographs a rich-text body's figures name, in one query.
 *
 * Deliberately not `resolveMedia`, which builds the whole `ApiImage`: a figure
 * inside prose needs a URL, a description and the two dimensions that stop the
 * page reflowing as it loads, and nothing else. A body with no figures in it
 * makes no query at all, which is most of them.
 */
async function resolveFigureMedia(html: string): Promise<Map<string, FigureMedia>> {
  const ids = richTextMediaIds(html);
  if (ids.length === 0) return new Map();

  const rows = await db.media.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: MEDIA_INCLUDE,
  });

  const map = new Map<string, FigureMedia>();
  for (const row of rows) {
    const image = img(row);
    if (!image) continue;
    map.set(row.id, {
      url: image.url,
      /* A decorative photograph carries `alt: ''` deliberately, and that is
         what should reach the page — not the filename, and not nothing. */
      alt: image.decorative ? '' : image.alt,
      width: image.width,
      height: image.height,
    });
  }
  return map;
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

/**
 * A place is visible when it is published *and* its valley is.
 *
 * Its address is made of its valley's slug, so a place under a hidden valley
 * would be a page whose breadcrumb and whose parent both 404. Hiding Paro
 * hides Taktsang with it, which is what the office means by hiding Paro.
 */
const PUBLISHED_DESTINATION = {
  ...PUBLISHED,
  OR: [{ parentId: null }, { parent: PUBLISHED }],
} satisfies Prisma.DestinationWhereInput;

const DESTINATION_SUMMARY_INCLUDE = {
  image: { include: MEDIA_INCLUDE },
  parent: {
    select: {
      slug: true,
      name: true,
      /* A place is offered by the journeys through its valley. */
      trips: {
        where: { offerOrder: { not: null } },
        orderBy: { offerOrder: 'asc' as const },
        include: { trip: { select: { slug: true, status: true, deletedAt: true } } },
      },
    },
  },
  places: {
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' as const },
    select: { slug: true, name: true },
  },
  trips: {
    /* The destination's own order, not the route's, and only the journeys
       it actually offers — a null `offerOrder` is a route that passes
       through. See `TripOnDestination` in the schema. */
    where: { offerOrder: { not: null } },
    orderBy: { offerOrder: 'asc' as const },
    include: { trip: { select: { slug: true, status: true, deletedAt: true } } },
  },
} satisfies Prisma.DestinationInclude;

type DestinationSummaryRow = Prisma.DestinationGetPayload<{
  include: typeof DESTINATION_SUMMARY_INCLUDE;
}>;

function serialiseDestinationSummary(row: DestinationSummaryRow): ApiDestinationSummary {
  /* A place has no journeys of its own; it is reached by the ones through
     its valley, and the page says so in those words. */
  const tripLinks = row.parent ? row.parent.trips : row.trips;

  return {
    slug: row.slug,
    name: row.name,
    path: destinationPath(row.slug, row.parent?.slug),
    parentSlug: row.parent?.slug ?? null,
    icon: ICON[row.icon],
    blurb: row.blurb,
    standfirst: row.standfirst,
    image: img(row.image),
    /* Unpublished journeys are filtered out here rather than in the query,
       because the join is already loaded and a second `where` on a nested
       relation is a second round trip for six rows. */
    tripSlugs: tripLinks
      .filter((link) => isLive(link.trip))
      .map((link) => link.trip.slug),
    altitudeMetres: row.altitudeMetres,
    latitude: row.latitude,
    longitude: row.longitude,
    places: row.parent
      ? []
      : row.places.map((place) => ({
          slug: place.slug,
          title: place.name,
          path: destinationPath(place.slug, row.slug),
        })),
  };
}

/** Every published valley and place, valleys first in their order. */
export async function listDestinations(): Promise<ApiDestinationSummary[]> {
  const rows = await db.destination.findMany({
    where: PUBLISHED_DESTINATION,
    orderBy: [{ sortOrder: 'asc' }],
    include: DESTINATION_SUMMARY_INCLUDE,
  });

  /* Valleys in their order, then places in theirs. A place's `sortOrder` is
     its position inside its valley, so sorting the two together would
     interleave Taktsang with Thimphu. */
  return [...rows.filter((row) => !row.parentId), ...rows.filter((row) => row.parentId)].map(
    serialiseDestinationSummary,
  );
}

/** The path a destination's page is at, published or not. For the preview check. */
export async function destinationPathForSlug(slug: string): Promise<string | null> {
  const row = await db.destination.findFirst({
    where: { slug, deletedAt: null },
    select: { slug: true, parent: { select: { slug: true } } },
  });
  return row ? destinationPath(row.slug, row.parent?.slug) : null;
}

export async function getDestination(
  slug: string,
  options?: { preview?: boolean },
): Promise<ApiDestination | null> {
  const preview = options?.preview === true;
  const row = await db.destination.findFirst({
    where: { slug, ...(preview ? { deletedAt: null } : PUBLISHED_DESTINATION) },
    include: {
      ...DESTINATION_SUMMARY_INCLUDE,
      ogImage: { include: MEDIA_INCLUDE },
      places: {
        where: PUBLISHED,
        orderBy: { sortOrder: 'asc' },
        include: DESTINATION_SUMMARY_INCLUDE,
      },
    },
  });
  if (!row) return null;

  /**
   * A valley's page gathers what is linked to its places as well.
   *
   * Punakha's page should say "see a dzong here" although the link was made
   * between dzongs and Punakha Dzong — the place is in the valley, and a
   * traveller reading about the valley is the one who needs to know.
   */
  const ids = [row.id, ...row.places.map((place) => place.id)];

  const [cultureLinks, posts] = await Promise.all([
    db.cultureOnDestination.findMany({
      where: { destinationId: { in: ids }, culture: PUBLISHED },
      orderBy: { sortOrder: 'asc' },
      include: { culture: { include: { image: { include: MEDIA_INCLUDE } } } },
    }),
    postsAbout({ destinations: { some: { destinationId: { in: ids } } } }),
  ]);

  const seen = new Set<string>();
  const culture = cultureLinks
    .map((link) => link.culture)
    .filter((article) => (seen.has(article.id) ? false : (seen.add(article.id), true)))
    .map(serialiseCultureSummary);

  const body = resolveRichTextMedia(row.body, await resolveFigureMedia(row.body));

  return {
    ...serialiseDestinationSummary(row),
    body,
    parent: row.parent
      ? { slug: row.parent.slug, title: row.parent.name, path: destinationPath(row.parent.slug, null) }
      : null,
    placeCards: row.places.map(serialiseDestinationSummary),
    culture,
    posts,
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

function serialiseCultureSummary(row: {
  slug: string;
  title: string;
  standfirst: string;
  icon: SiteIcon;
  image: MediaWithRenditions | null;
}): ApiCultureSummary {
  return {
    slug: row.slug,
    title: row.title,
    path: culturePath(row.slug),
    standfirst: row.standfirst,
    icon: ICON[row.icon],
    image: img(row.image),
  };
}

export async function listCulture(): Promise<ApiCultureSummary[]> {
  const rows = await db.cultureArticle.findMany({
    where: PUBLISHED,
    orderBy: { sortOrder: 'asc' },
    include: { image: { include: MEDIA_INCLUDE } },
  });
  return rows.map(serialiseCultureSummary);
}

export async function getCulture(
  slug: string,
  options?: { preview?: boolean },
): Promise<ApiCultureArticle | null> {
  const row = await db.cultureArticle.findFirst({
    where: { slug, ...visible(options?.preview === true) },
    include: {
      image: { include: MEDIA_INCLUDE },
      ogImage: { include: MEDIA_INCLUDE },
      destinations: {
        orderBy: { sortOrder: 'asc' },
        where: { destination: PUBLISHED_DESTINATION },
        include: { destination: { include: DESTINATION_SUMMARY_INCLUDE } },
      },
    },
  });
  if (!row) return null;

  const [posts, body] = await Promise.all([
    postsAbout({ culture: { some: { cultureId: row.id } } }),
    resolveFigureMedia(row.body).then((media) => resolveRichTextMedia(row.body, media)),
  ]);

  return {
    ...serialiseCultureSummary(row),
    body,
    destinations: row.destinations.map((link) => serialiseDestinationSummary(link.destination)),
    posts,
    seo: serialiseSeo(row, img(row.ogImage)),
  };
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
  const SEO_FIELDS = { updatedAt: true, sitemapPriority: true, sitemapChangeFreq: true } as const;

  const [trips, posts, pages, destinations, culture] = await Promise.all([
    db.trip.findMany({
      where: { ...PUBLISHED, noIndex: false },
      select: { slug: true, ...SEO_FIELDS },
    }),
    db.post.findMany({
      where: { ...PUBLISHED, noIndex: false },
      select: { slug: true, category: true, ...SEO_FIELDS },
    }),
    db.page.findMany({
      where: { ...PUBLISHED, noIndex: false, showInSitemap: true },
      select: { path: true, ...SEO_FIELDS },
    }),
    db.destination.findMany({
      where: { ...PUBLISHED_DESTINATION, noIndex: false },
      select: { slug: true, parent: { select: { slug: true } }, ...SEO_FIELDS },
    }),
    db.cultureArticle.findMany({
      where: { ...PUBLISHED, noIndex: false },
      select: { slug: true, ...SEO_FIELDS },
    }),
  ]);

  const entry = (
    path: string,
    row: { updatedAt: Date; sitemapPriority: number; sitemapChangeFreq: string },
  ) => ({
    path,
    lastModified: row.updatedAt.toISOString(),
    changeFrequency: row.sitemapChangeFreq as ApiSeo['sitemapChangeFreq'],
    priority: row.sitemapPriority,
  });

  /**
   * A shelf of the journal is listed only when something is on it.
   *
   * An empty category page is a thin page, and a sitemap that offers a
   * crawler four of them on day one is four reasons to think less of the
   * site. Its freshness is its newest entry's.
   */
  const shelves = new Map<string, Date>();
  for (const post of posts) {
    const key = CATEGORY_TO_WIRE[post.category];
    const current = shelves.get(key);
    if (!current || post.updatedAt > current) shelves.set(key, post.updatedAt);
  }

  const entries = [
    ...pages.map((page) => entry(page.path, page)),
    ...trips.map((trip) => entry(`/trips/${trip.slug}`, trip)),
    ...destinations.map((row) => entry(destinationPath(row.slug, row.parent?.slug), row)),
    ...culture.map((row) => entry(culturePath(row.slug), row)),
    ...posts.map((post) => entry(postPath(post.slug), post)),
    ...[...shelves].map(([key, updatedAt]) => ({
      path: `/journal/category/${key}`,
      lastModified: updatedAt.toISOString(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];

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
