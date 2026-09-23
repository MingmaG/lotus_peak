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
/**
 * The silhouettes the design system can draw.
 *
 * The first seven are building types, and the admin stores them as the
 * `SiteIcon` enum. The last three name a single place each — Taktsang, Punakha
 * and Jakar — because those three dzongs read as themselves rather than as a
 * generic dzong, and the destinations pages use them. They are not in the
 * admin's enum yet, so only the file provider can set them for now.
 */
export type SiteIconName =
  | 'dzong'
  | 'chorten'
  | 'stupa'
  | 'monastery'
  | 'pavilion'
  | 'dzong-long'
  | 'buddha'
  | 'taktsang'
  | 'punakha'
  | 'jakar';

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

/** A heading over some of a journey's questions. */
export interface ApiTripFaqGroup {
  title: string;
  blurb: string | null;
  items: ApiTripFaq[];
}

/** What a journey costs at a given party size. */
export interface ApiPricingTier {
  label: string;
  minPeople: number;
  /** Null is "and above" — the last tier has no ceiling. */
  maxPeople: number | null;
  priceUsd: number;
  wasPriceUsd: number | null;
  note: string | null;
}

/** One of the figures under the title, beyond the fixed five. */
export interface ApiTripStat {
  label: string;
  value: string;
  note: string | null;
}

/** A point on the walking profile. `day` is the number the itinerary shows. */
export interface ApiElevationPoint {
  day: number;
  label: string;
  metres: number;
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
  /**
   * A fixed departure runs on this date whoever books it.
   *
   * The rest are "we will find a date together", which is how most of these
   * journeys are sold — so the site lists the fixed ones as a calendar and
   * leaves the others as an invitation to write.
   */
  isFixed: boolean;
  /** Struck through beside the price, for an early-booking rate. */
  wasPriceUsd: number | null;
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
  /** ISO 4217. Bhutan quotes in dollars and always has. */
  priceCurrency: string;
  /** Rich text: what the price includes, under the figure. */
  priceNote: string | null;
  /** Empty where one price covers every party size. */
  pricingTiers: ApiPricingTier[];
  /** "Spring and autumn". Prose, because the real answer is not a month range. */
  seasonLabel: string;
  seasonKeys: SeasonKey[];
  paceNote: string;
  /** "A journey of eleven days". The line under the title on the trip page. */
  journeyLabel: string;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  heroImage: ApiImage | null;
  /** The route drawn on a map. A picture, not a live map. */
  routeMap: ApiImage | null;
  /** A film, where there is one. Rendered as a façade, never as an iframe. */
  videoUrl: string | null;
  overview: string[];
  /** Beyond the fixed five. Usually empty. */
  stats: ApiTripStat[];
  /** Empty for everything but the trekking journeys. */
  elevationProfile: ApiElevationPoint[];
  highlights: string[];
  itinerary: ApiItineraryDay[];
  included: string[];
  excluded: string[];
  /**
   * The questions with no heading, which render first.
   *
   * Split from `faqGroups` rather than given a nullable `group`, because the
   * page draws them differently — these have no heading above them at all —
   * and a renderer that has to filter a flat list by a null field is a
   * renderer that will one day forget to.
   */
  faq: ApiTripFaq[];
  faqGroups: ApiTripFaqGroup[];
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

/* -------------------------------------------------------------------------- */
/*  Where we go, Culture, Journal                                              */
/* -------------------------------------------------------------------------- */

/**
 * The three sections, and the one rule between them: nothing appears in two.
 *
 * - **Where we go** answers *where can I go?* A valley — Paro — or a place
 *   inside one — Taktsang. One type at two scales; `parentSlug` says which.
 * - **Culture** answers *what makes Bhutan Bhutan?* Tshechu, dzongs, the
 *   thirteen arts. Not a place: a dzong in general is culture, Punakha Dzong
 *   is a destination.
 * - **The journal** answers *what should I read?* Dated editorial on one of
 *   four shelves. An entry can be *about* Paro or about dzongs; it links to
 *   those pages rather than describing them again.
 *
 * Every record carries its `path`, computed by the panel. A place's URL
 * depends on its valley's slug, and the website working that out a second
 * time is a second place for `/destinations/paro/taktsang` to be spelt.
 */

/** Just enough to link to a page: a breadcrumb, a chip, an entry's "about". */
export interface ApiPageRef {
  slug: string;
  title: string;
  path: string;
}

/** A valley or a place, as a card draws it. */
export interface ApiDestinationSummary {
  slug: string;
  name: string;
  path: string;
  /** Null for a valley. A place names the valley it is in. */
  parentSlug: string | null;
  icon: SiteIconName;
  /** One line. "Taktsang, Kichu and Dungtse Lhakhang". */
  blurb: string;
  /** The sentence under the title. */
  standfirst: string;
  image: ApiImage | null;
  /** Journeys offered there, in the order the destination offers them. */
  tripSlugs: string[];
  altitudeMetres: number | null;
  latitude: number | null;
  longitude: number | null;
  /** A valley's places, in order. Always empty on a place. */
  places: ApiPageRef[];
}

/** A destination's own page. */
export interface ApiDestination extends ApiDestinationSummary {
  /** Rich text. Sanitised by the website before it is rendered. */
  body: string;
  parent: ApiPageRef | null;
  /** The places inside a valley, as cards. Empty on a place. */
  placeCards: ApiDestinationSummary[];
  /** The culture a traveller sees here. */
  culture: ApiCultureSummary[];
  /** Journal entries about this place. */
  posts: ApiPostSummary[];
  seo: ApiSeo;
}

/** A culture piece, as a card draws it. */
export interface ApiCultureSummary {
  slug: string;
  title: string;
  path: string;
  standfirst: string;
  icon: SiteIconName;
  image: ApiImage | null;
}

/** A culture piece's own page. */
export interface ApiCultureArticle extends ApiCultureSummary {
  /** Rich text. Sanitised by the website before it is rendered. */
  body: string;
  /** Where to see it. */
  destinations: ApiDestinationSummary[];
  /** Journal entries that explain more of it. */
  posts: ApiPostSummary[];
  seo: ApiSeo;
}

/**
 * The four shelves of the journal, in the order the tabs show them.
 *
 * Keys are URL segments — `/journal/category/travel-guides` — and the labels
 * are the tab names. They live here rather than in a row because a fifth shelf
 * is a design decision, not something added on a Tuesday, and because both
 * apps have to call them the same thing.
 */
export const JOURNAL_CATEGORIES = [
  {
    key: 'journeys',
    label: 'Journeys',
    description: 'Travel stories and itineraries, told after the fact.',
  },
  {
    key: 'travel-guides',
    label: 'Travel guides',
    description: 'The practical side: permits, seasons, what it costs and what to bring.',
  },
  {
    key: 'experiences',
    label: 'Experiences',
    description: 'Things to do in Bhutan, and what they are actually like.',
  },
  {
    key: 'stories',
    label: 'Stories',
    description: 'People, places and perspectives.',
  },
] as const;

export type JournalCategory = (typeof JOURNAL_CATEGORIES)[number]['key'];

export function journalCategoryLabel(key: JournalCategory): string {
  return JOURNAL_CATEGORIES.find((category) => category.key === key)?.label ?? key;
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
 * A journal body: one rich-text document, as HTML.
 *
 * It was a union of typed blocks — a paragraph, a heading, a list, a quote, a
 * photograph, a facts table — each edited in its own little form. That shape
 * was chosen so the design could draw each kind its own way and nothing could
 * express markup the design had no styles for.
 *
 * It cost more than it bought. Writing an entry meant deciding which box each
 * sentence went in before writing the sentence; a photograph could not sit in
 * the middle of a paragraph; a table had two columns or it did not exist; and
 * every *other* long-form field on this site — a journey's overview, an
 * itinerary day, a page band, a teacher's biography — had already moved to the
 * rich-text editor and was one HTML string. The journal was the last field
 * being edited a different way from all the others.
 *
 * What replaces the closed union is not "anything goes". The editor emits a
 * fixed vocabulary, and `apps/web/src/lib/rich-text.ts` rebuilds the body from
 * an allowlist of the elements it may contain, dropping everything else — so a
 * `<h1 style="color:red">` pasted from a Word document still cannot reach a
 * page. The guarantee moved from the type to the renderer, where it also
 * covers the eleven other fields that were already HTML.
 *
 * A photograph inside a body is a `<figure data-media-id="…">`. The id is what
 * is stored; `src` and the fallback `alt` are filled in from the media row on
 * the way out, so replacing or re-describing a photograph in the library still
 * reaches every entry that used it.
 */
export interface ApiPost {
  slug: string;
  title: string;
  standfirst: string;
  /** ISO date. Sorting and `<time dateTime>` both read this. */
  date: string;
  category: JournalCategory;
  heroImage: ApiImage | null;
  /** Rich text. Sanitised by the website before it is rendered. */
  body: string;
  author: { name: string; role: string | null; avatar: ApiImage | null } | null;
  tags: string[];
  relatedTripSlugs: string[];
  /** The places it is about, and the culture it explains. Links, not copies. */
  destinations: ApiDestinationSummary[];
  culture: ApiCultureSummary[];
  /** Minutes, computed by the admin so both apps say the same number. */
  readingMinutes: number;
  seo: ApiSeo;
}

export interface ApiPostSummary {
  slug: string;
  title: string;
  path: string;
  standfirst: string;
  date: string;
  category: JournalCategory;
  /** The places it is about, for the line above the title. */
  places: ApiPageRef[];
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
