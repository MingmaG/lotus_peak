/**
 * The wire format between the admin panel and the website.
 *
 * Types only — no runtime, no dependency, no database client. The admin panel
 * maps Prisma rows into these shapes in `src/server/services/public-site.ts`;
 * the website maps them into its own domain types in
 * `src/content/providers/api/`. Neither app can see the other's internals, and
 * a field that changes shape is a compile error in both at once rather than a
 * page that renders `undefined` in production.
 *
 * Two conventions run through all of it:
 *
 * - **Nothing is pre-formatted.** Prices are numbers, dates are ISO strings,
 *   altitudes are metres. The design has exact opinions about thin spaces and
 *   middots (`fmt` in the website's `content/types.ts`), and a payload that
 *   arrives as "US$ 4,500" is a payload that cannot be sorted or recalculated.
 * - **Ordering is explicit.** Every list arrives in the order the office chose.
 *   Arrays are ordered; the `order` column that produced them is not sent,
 *   because a consumer that re-sorts is a consumer that can disagree with the
 *   admin's own preview.
 */

/* -------------------------------------------------------------------------- */
/*  Envelope                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every public endpoint answers in this shape.
 *
 * The envelope exists so a payload can carry `generatedAt` without every
 * consumer having to special-case a bare array, and so an error is a typed
 * body rather than an HTML error page the website would try to `JSON.parse`.
 */
export interface ApiEnvelope<T> {
  data: T;
  /** When the admin panel built this payload. ISO 8601. */
  generatedAt: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

/* -------------------------------------------------------------------------- */
/*  Revalidation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Cache tags. The admin names the ones it touched when it publishes; the
 * website tags every fetch with them.
 *
 * `discovery` is its own tag rather than a member of the others because the
 * sitemap, robots.txt, llms.txt and the feed are invalidated by *everything*
 * and rendered by almost nothing. Folding it into `trips` would drop the one
 * cache entry that is expensive to rebuild on every single publish.
 */
export const REVALIDATE_TAGS = {
  trips: 'trips',
  destinations: 'destinations',
  activities: 'activities',
  seasons: 'seasons',
  culture: 'culture',
  journal: 'journal',
  gallery: 'gallery',
  reflections: 'reflections',
  pages: 'pages',
  navigation: 'navigation',
  site: 'site',
  redirects: 'redirects',
  discovery: 'discovery',
  emails: 'emails',
} as const;

export type RevalidateTag = (typeof REVALIDATE_TAGS)[keyof typeof REVALIDATE_TAGS];

export interface RevalidateRequest {
  tags: RevalidateTag[];
  /** Exact paths to drop as well, e.g. `/trips/valleys`. */
  paths?: string[];
  /** ISO timestamp, part of the signed payload. Rejected if badly skewed. */
  issuedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Media                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * An image, as the website receives it.
 *
 * `width` and `height` are required, not optional. `next/image` needs them to
 * reserve the box, and an image without them is a layout shift on every page
 * it appears on — so the admin refuses to publish a media row it could not
 * measure rather than sending a payload the website has to guess at.
 *
 * `alt` is required for the same reason it is required in the database: an
 * optional alt is an empty alt. Decorative images carry `alt: ''` explicitly
 * and `decorative: true`, which is a decision someone made rather than a
 * field someone skipped.
 */
export interface ApiImage {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  /** Blurred placeholder, base64 data URI. Null when it could not be made. */
  blurDataUrl: string | null;
  /**
   * Focal point as fractions of the box, `[0.5, 0.5]` being the centre.
   *
   * The design crops hard — parallax bands, masked strips, 3/4 masonry cells —
   * and a face centred in the source is not a face centred in a 16/9 crop of
   * it. This becomes `object-position` on the site.
   */
  focal: [x: number, y: number];
  decorative: boolean;
  caption: string | null;
  credit: string | null;
}

/* -------------------------------------------------------------------------- */
/*  SEO                                                                        */
/* -------------------------------------------------------------------------- */

/** The SEO block every addressable entity carries. */
export interface ApiSeo {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: ApiImage | null;
  twitterCard: 'summary' | 'summary_large_image';
  keywords: string[];
  /** Hand-written JSON-LD merged into the generated graph. Rarely used. */
  schemaJson: unknown | null;
  sitemapPriority: number;
  sitemapChangeFreq:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  /** ISO 8601, for `<lastmod>` and `dateModified`. */
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Site-wide: the company, in one place                                       */
/* -------------------------------------------------------------------------- */

export type SocialPlatform =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'YOUTUBE'
  | 'X'
  | 'TIKTOK'
  | 'LINKEDIN'
  | 'PINTEREST'
  | 'TRIPADVISOR'
  | 'WHATSAPP'
  | 'THREADS'
  | 'OTHER';

export interface ApiSocialLink {
  platform: SocialPlatform;
  /** Shown as the link text where a name is wanted. "Lotus Peak Bhutan". */
  label: string;
  /** `@lotuspeak`, without the URL. Null where the platform has no handle. */
  handle: string | null;
  url: string;
}

export type ContactChannelKind =
  | 'PHONE'
  | 'MOBILE'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'FAX';

/**
 * One way to reach the company.
 *
 * `value` is the machine form — `+97517984485` for a phone, `info@lotuspeak.org`
 * for an email — and `display` is what a human reads: `+975 17984485`. Storing
 * both is not duplication: `tel:` needs the first and the footer needs the
 * second, and deriving either from the other means a formatter that has to know
 * Bhutanese numbering.
 */
export interface ApiContactChannel {
  kind: ContactChannelKind;
  label: string;
  value: string;
  display: string;
  isPrimary: boolean;
  /** WhatsApp only: the message the deep link pre-fills. */
  prefillMessage?: string | null;
}

export interface ApiAddress {
  /** What the footer prints, on its own line. "Norzin Lam, Thimphu". */
  line1: string;
  line2: string | null;
  /** `addressLocality` in the structured data. "Thimphu". */
  locality: string;
  /** `addressRegion`. The dzongkhag. */
  region: string | null;
  postalCode: string | null;
  country: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  /** A Google Maps or Plus Code link, when the office keeps one. */
  mapUrl: string | null;
}

export interface ApiOfficeHours {
  /** 1 = Monday … 7 = Sunday, matching ISO-8601 and `dayOfWeek` in schema.org. */
  dayFrom: number;
  dayTo: number;
  /** `09:00`. Null on a closed row. */
  opens: string | null;
  closes: string | null;
  closed: boolean;
}

export interface ApiCompany {
  legalName: string;
  /** What the site calls itself. "Lotus Peak". */
  name: string;
  tagline: string;
  description: string;
  foundedYear: number | null;
  /** Tourism Council of Bhutan licence, shown in the footer. */
  licenceNumber: string | null;
  registrationNumber: string | null;
  logo: ApiImage | null;
  /** Square, for the JSON-LD and the PWA icons. */
  markLogo: ApiImage | null;
  address: ApiAddress;
  contacts: ApiContactChannel[];
  socials: ApiSocialLink[];
  officeHours: ApiOfficeHours[];
}

export interface ApiNavLink {
  label: string;
  href: string;
  /** Opens in a new tab. */
  external: boolean;
  children: ApiNavLink[];
}

export interface ApiFooterColumn {
  title: string;
  links: ApiNavLink[];
}

/**
 * Everything the root layout needs, in one request.
 *
 * One object rather than five endpoints because the navigation, the footer, the
 * contact line and the default SEO are rendered on *every* page, and four
 * fetches per page render is four cache entries that can disagree about which
 * publish they came from.
 */
export interface ApiSite {
  company: ApiCompany;
  nav: ApiNavLink[];
  navCta: { label: string; href: string } | null;
  footer: {
    columns: ApiFooterColumn[];
    note: string;
    /** `© {year} {name}` — the tokens are substituted by the website. */
    copyright: string;
  };
  /** "Personally, within two days". Shown beside the enquiry form. */
  replyPromise: string;
  /** The monastery pledge the About and home pages state. */
  pledge: { percent: number; beneficiary: string; note: string | null } | null;
  /** Sustainable Development Fee, US$ per person per night. */
  sdfPerNightUsd: number;
  defaultSeo: {
    titleTemplate: string;
    defaultTitle: string;
    description: string;
    ogImage: ApiImage | null;
  };
  /** Absolute, no trailing slash. Canonicals and JSON-LD are built from it. */
  siteUrl: string;
  integrations: {
    googleAnalyticsId: string | null;
    googleTagManagerId: string | null;
    googleSiteVerification: string | null;
    metaPixelId: string | null;
    /** `+97517984485`, digits only — the wa.me path segment. */
    whatsappNumber: string | null;
    whatsappPrefill: string | null;
    tripadvisorWidgetId: string | null;
  };
  announcement: {
    message: string;
    href: string | null;
    linkLabel: string | null;
  } | null;
}

/* -------------------------------------------------------------------------- */
/*  Trips                                                                      */
/* -------------------------------------------------------------------------- */

export type TripType = 'mindfulness' | 'meditation' | 'festival' | 'trekking';
export type Difficulty = 'Gentle' | 'Moderate' | 'Demanding';
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';
export type SiteIconName =
  | 'dzong'
  | 'chorten'
  | 'stupa'
  | 'monastery'
  | 'pavilion'
  | 'dzong-long'
  | 'buddha';

export interface ApiItineraryDay {
  /**
   * Null on a rest day.
   *
   * The number is *computed* by the admin from position, never stored. An
   * itinerary with a day inserted at the front is an itinerary where every
   * stored number is now wrong, and the office should not have to renumber
   * fourteen rows to add an arrival day.
   */
  day: number | null;
  rest: boolean;
  title: string;
  /** "Paro · 2,280 m · 4 h drive". */
  meta: string | null;
  body: string | null;
  images: ApiImage[];
}

export interface ApiTripFaq {
  question: string;
  answer: string;
}

export interface ApiTripGalleryItem {
  image: ApiImage;
  /** CSS aspect ratio for the masonry cell, e.g. `3/4`. */
  ratio: string | null;
  /** Grid span hint the design's strip uses, e.g. `2`. */
  width: string | null;
}

/** A dated departure with places on it. Absent from the design; additive. */
export interface ApiDeparture {
  id: string;
  startDate: string;
  endDate: string;
  priceUsd: number;
  /** Null where the office does not publish capacity. */
  placesTotal: number | null;
  placesLeft: number | null;
  status: 'OPEN' | 'GUARANTEED' | 'FEW_PLACES' | 'CLOSED' | 'CANCELLED';
  note: string | null;
}

export interface ApiTrip {
  slug: string;
  title: string;
  excerpt: string;
  type: TripType;
  /** Ordered destination names, joined with a middot by the website. */
  regions: string[];
  destinationSlugs: string[];
  durationDays: number;
  nights: number;
  highPointMetres: number;
  difficulty: Difficulty;
  priceFromUsd: number;
  /** "Spring and autumn". Prose, because the real answer is not a month range. */
  seasonLabel: string;
  seasonKeys: SeasonKey[];
  paceNote: string;
  /** "A journey of eleven days". The line under the title on the trip page. */
  journeyLabel: string;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  heroImage: ApiImage | null;
  overview: string[];
  highlights: string[];
  itinerary: ApiItineraryDay[];
  included: string[];
  excluded: string[];
  faq: ApiTripFaq[];
  gallery: ApiTripGalleryItem[];
  departures: ApiDeparture[];
  /** Other journeys to offer at the foot of this one, in the order chosen. */
  relatedSlugs: string[];
  featured: boolean;
  seo: ApiSeo;
}

/** The list payload. Everything a `TrekCard` renders and nothing more. */
export interface ApiTripSummary {
  slug: string;
  title: string;
  excerpt: string;
  type: TripType;
  regions: string[];
  durationDays: number;
  nights: number;
  highPointMetres: number;
  difficulty: Difficulty;
  priceFromUsd: number;
  seasonLabel: string;
  journeyLabel: string;
  heroImage: ApiImage | null;
  featured: boolean;
}

/* -------------------------------------------------------------------------- */
/*  The rest of the catalogue                                                  */
/* -------------------------------------------------------------------------- */

export interface ApiDestination {
  slug: string;
  name: string;
  icon: SiteIconName;
  blurb: string;
  detail: string;
  image: ApiImage | null;
  tripSlugs: string[];
  altitudeMetres: number | null;
  latitude: number | null;
  longitude: number | null;
  seo: ApiSeo;
}

export interface ApiActivity {
  slug: string;
  name: string;
  blurb: string;
  icon: SiteIconName;
  image: ApiImage | null;
  examples: string[];
  tripSlugs: string[];
  seo: ApiSeo;
}

export interface ApiSeason {
  key: SeasonKey;
  monthsLabel: string;
  name: string;
  headline: string;
  summary: string;
  detail: string;
  image: ApiImage | null;
}

export interface ApiCultureArticle {
  slug: string;
  title: string;
  body: string;
  icon: SiteIconName;
  image: ApiImage | null;
  seo: ApiSeo;
}

export interface ApiGalleryImage {
  image: ApiImage;
  caption: string;
  ratio: string;
}

export interface ApiReflection {
  id: string;
  quote: string;
  name: string;
  detail: string | null;
  tripSlug: string | null;
  featured: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Journal                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A journal body, as ordered typed blocks.
 *
 * Deliberately not one string of rich-text HTML. The design renders a `facts`
 * block as a bordered definition list in the site's own type scale and a
 * `quote` as a `Reflection`; HTML from a WYSIWYG toolbar renders as whatever
 * the toolbar emitted, and the first `<h1 style="color:red">` an editor pastes
 * in is a design-system breach nobody can see until it is live.
 *
 * Inline formatting *inside* a `text` block is allowed and is a restricted
 * subset — bold, italic, link, and nothing else — so a sentence can carry a
 * link without a block type for it.
 */
export type ApiPostBlock =
  | { kind: 'text'; body: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[]; ordered: boolean }
  | { kind: 'quote'; text: string; attribution: string | null }
  | { kind: 'image'; image: ApiImage; ratio: string | null }
  | { kind: 'facts'; title: string; rows: [label: string, value: string][] };

export interface ApiPost {
  slug: string;
  title: string;
  standfirst: string;
  /** ISO date. Sorting and `<time dateTime>` both read this. */
  date: string;
  region: string;
  heroImage: ApiImage | null;
  body: ApiPostBlock[];
  author: { name: string; role: string | null; avatar: ApiImage | null } | null;
  tags: string[];
  relatedTripSlugs: string[];
  /** Minutes, computed by the admin so both apps say the same number. */
  readingMinutes: number;
  seo: ApiSeo;
}

export interface ApiPostSummary {
  slug: string;
  title: string;
  standfirst: string;
  date: string;
  region: string;
  heroImage: ApiImage | null;
  readingMinutes: number;
}

/* -------------------------------------------------------------------------- */
/*  Pages                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A section of an editorial page.
 *
 * A closed union rather than a free block builder. The design composes About,
 * Terms and Travellers' information from a fixed vocabulary of bands, and an
 * editor who can invent an eleventh section type is an editor who can build a
 * page the design has no styles for.
 */
export type ApiPageSection =
  | {
      kind: 'prose';
      eyebrow: string | null;
      title: string | null;
      body: string;
      /** The fragment this band answers to. Null means "from the title". */
      anchor: string | null;
    }
  | {
      kind: 'points';
      eyebrow: string | null;
      title: string | null;
      lead: string | null;
      points: { title: string; body: string; icon: SiteIconName | null }[];
    }
  | {
      kind: 'facts';
      title: string | null;
      rows: [label: string, value: string][];
    }
  | {
      kind: 'faq';
      title: string | null;
      items: ApiTripFaq[];
    }
  | {
      kind: 'figure';
      image: ApiImage;
      caption: string | null;
      /** `full` breaks the container; `inset` stays within it. */
      width: 'full' | 'inset';
    }
  | {
      kind: 'gallery';
      title: string | null;
      items: ApiTripGalleryItem[];
    }
  | {
      kind: 'reflections';
      title: string | null;
      reflectionIds: string[];
    }
  | {
      kind: 'trips';
      title: string | null;
      lead: string | null;
      tripSlugs: string[];
    }
  | {
      kind: 'cta';
      title: string;
      lead: string | null;
      label: string;
      href: string;
      /** The dark `Band` treatment, or plain on the page's own white. */
      band: boolean;
    }
  | {
      kind: 'people';
      title: string | null;
      lead: string | null;
      personIds: string[];
    };

export interface ApiPage {
  slug: string;
  path: string;
  title: string;
  eyebrow: string | null;
  lead: string | null;
  heroImage: ApiImage | null;
  sections: ApiPageSection[];
  seo: ApiSeo;
}

export interface ApiPerson {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: ApiImage | null;
  languages: string[];
  socials: ApiSocialLink[];
}

/* -------------------------------------------------------------------------- */
/*  Discovery                                                                  */
/* -------------------------------------------------------------------------- */

export interface ApiSitemapEntry {
  path: string;
  lastModified: string;
  changeFrequency: ApiSeo['sitemapChangeFreq'];
  priority: number;
}

export interface ApiRedirect {
  source: string;
  target: string;
  permanent: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Enquiries — the one thing the website writes                               */
/* -------------------------------------------------------------------------- */

export type EnquirySource = 'contact' | 'trip-detail' | 'drawer' | 'newsletter';

export interface ApiEnquiryInput {
  name: string;
  email: string;
  country?: string;
  phone?: string;
  tripSlug?: string;
  travellers?: string;
  adults?: number;
  children?: number;
  preferredDates?: string;
  message?: string;
  restDays?: boolean;
  source: EnquirySource;
  /** Must arrive empty. A bot filled it in. */
  honeypot?: string;
  /** Where the enquiry was made, for attribution. */
  pagePath?: string;
  utm?: Record<string, string>;
}

export interface ApiEnquiryResult {
  id: string;
  reference: string;
}
