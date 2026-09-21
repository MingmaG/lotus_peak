import type {
  ApiCompany,
  ApiCultureArticle,
  ApiDestination,
  ApiImage,
  ApiPage,
  ApiPost,
  ApiSeo,
  ApiSite,
  ApiTrip,
  ApiTripFaq,
  ApiTripSummary,
} from '@lotuspeak/api-contracts';

/**
 * The structured data both apps publish.
 *
 * ## Why this is a package and not a file in the website
 *
 * Because the admin panel has to show the office what the website will emit,
 * and a preview that is merely close is a preview nobody checks against. One
 * builder, called by the website to render the markup and by the admin to
 * preview it, over the same payload. When the preview is wrong, the markup is
 * wrong — which is the only useful kind of preview.
 *
 * ## One graph per page, not six scripts
 *
 * Every page emits a single `<script type="application/ld+json">` holding a
 * `@graph`:
 *
 * ```
 *   TravelAgency  #organization   ← who is selling
 *   WebSite       #website        ← what this domain is
 *   WebPage       <url>#webpage   ← this page, inside that site
 *   BreadcrumbList                ← where this page sits
 *   <the thing>                   ← TouristTrip, Article, ItemList…
 *   FAQPage                       ← only where the answers are on the page
 * ```
 *
 * Six separate scripts describe six things and leave a crawler to work out
 * that they are related. A `@graph` with `@id` references *states* it: the
 * journey's `provider` **is** the organisation the page already described.
 * That is what turns a pile of markup into an entity a knowledge graph can
 * hold — and an entity is what gets named when somebody asks an assistant
 * which operator to see Bhutan with.
 *
 * ## `siteUrl` is a parameter
 *
 * Passed in by both apps from their own config, never imported, because every
 * `@id` in the graph is built from it. An `@id` that changes between renders
 * is not an identifier, and two renders disagreeing about the company's `@id`
 * is two companies.
 *
 * ## What is deliberately absent
 *
 * - **No `AggregateRating`, no `Review`.** Lotus Peak publishes reflections —
 *   a quote and a quiet attribution — and the design forbids star ratings. A
 *   rating in the markup that the page does not show is exactly the mismatch
 *   Google's structured-data policy prohibits, and inventing a number to fill
 *   the field would be worse.
 * - **No `Offer` price without a real one.** `priceFromUsd` is a *from* price;
 *   it is published as a `lowPrice` on an `AggregateOffer`, which is what it
 *   is, rather than as a `price` that pretends to be the price.
 */

type Json = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const abs = (siteUrl: string, path: string): string =>
  `${siteUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Drops empty values from a node.
 *
 * Not cosmetic. `"description": null` and `"sameAs": []` are claims — that the
 * company has no description, that it is on no platform — and validators
 * report them. An absent key says nothing, which is the truth.
 */
function clean<T extends Json>(node: T): T {
  const out: Json = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as T;
}

/** ISO 8601 duration. 11 days → `P11D`. */
export function isoDuration(days: number): string {
  return `P${Math.max(1, Math.round(days))}D`;
}

function imageNode(siteUrl: string, image: ApiImage | null): Json | undefined {
  if (!image) return undefined;
  return clean({
    '@type': 'ImageObject',
    url: image.url.startsWith('http') ? image.url : abs(siteUrl, image.url),
    width: image.width,
    height: image.height,
    caption: image.caption ?? (image.decorative ? undefined : image.alt),
  });
}

/* -------------------------------------------------------------------------- */
/*  The identity nodes, on every page                                          */
/* -------------------------------------------------------------------------- */

export const ORGANIZATION_ID = (siteUrl: string) => `${siteUrl}/#organization`;
export const WEBSITE_ID = (siteUrl: string) => `${siteUrl}/#website`;

/**
 * The company.
 *
 * `TravelAgency` rather than `Organization` or `LocalBusiness`: it is the type
 * that carries both `areaServed` and the local-business properties, and it is
 * what a travel query resolves against.
 *
 * Every field here comes from the one company record in the admin panel. That
 * is the whole reason the address is stored in parts — `addressLocality` needs
 * "Thimphu" and the footer prints "Norzin Lam, Thimphu", and a search engine
 * told the locality is "Norzin Lam" places the company in a street.
 */
export function organizationNode(siteUrl: string, site: ApiSite): Json {
  const c: ApiCompany = site.company;
  const a = c.address;

  return clean({
    '@type': 'TravelAgency',
    '@id': ORGANIZATION_ID(siteUrl),
    name: c.name,
    legalName: c.legalName !== c.name ? c.legalName : undefined,
    description: c.description || c.tagline,
    slogan: c.tagline,
    url: siteUrl,
    logo: imageNode(siteUrl, c.markLogo ?? c.logo),
    image: imageNode(siteUrl, c.logo ?? c.markLogo),
    foundingDate: c.foundedYear ? String(c.foundedYear) : undefined,
    telephone: c.contacts.find((x) => x.kind === 'PHONE' || x.kind === 'MOBILE')
      ?.value,
    email: c.contacts.find((x) => x.kind === 'EMAIL')?.value,
    address: clean({
      '@type': 'PostalAddress',
      streetAddress: [a.line1, a.line2].filter(Boolean).join(', '),
      addressLocality: a.locality,
      addressRegion: a.region,
      postalCode: a.postalCode,
      addressCountry: a.countryCode,
    }),
    geo:
      a.latitude !== null && a.longitude !== null
        ? { '@type': 'GeoCoordinates', latitude: a.latitude, longitude: a.longitude }
        : undefined,
    hasMap: a.mapUrl,
    openingHoursSpecification: c.officeHours
      .filter((h) => !h.closed && h.opens && h.closes)
      .map((h) =>
        clean({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: dayRange(h.dayFrom, h.dayTo),
          opens: h.opens,
          closes: h.closes,
        }),
      ),
    /**
     * Every platform the company is on, as URLs.
     *
     * This is the single most load-bearing property for entity resolution: it
     * is how a crawler decides that the Instagram account, the Facebook page
     * and this domain are one organisation rather than three. It is built from
     * the social-link rows, so adding a platform in the admin adds it here.
     */
    sameAs: c.socials.map((s) => s.url),
    areaServed: { '@type': 'Country', name: 'Bhutan' },
    /**
     * What the company actually sells, so a query for "meditation retreat
     * Bhutan" has something to match beyond the prose.
     */
    knowsAbout: [
      'Bhutan travel',
      'Buddhist meditation retreats',
      'Bhutanese festivals and tshechu',
      'Himalayan trekking',
      'Mindfulness travel',
    ],
    identifier: c.licenceNumber
      ? clean({
          '@type': 'PropertyValue',
          name: 'Tourism Council of Bhutan licence',
          value: c.licenceNumber,
        })
      : undefined,
  });
}

function dayRange(from: number, to: number): string[] {
  const NAMES = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  const out: string[] = [];
  for (let d = from; d <= to; d += 1) {
    const name = NAMES[d - 1];
    if (name) out.push(`https://schema.org/${name}`);
  }
  return out;
}

export function websiteNode(siteUrl: string, site: ApiSite): Json {
  return clean({
    '@type': 'WebSite',
    '@id': WEBSITE_ID(siteUrl),
    url: siteUrl,
    name: site.company.name,
    description: site.defaultSeo.description,
    publisher: { '@id': ORGANIZATION_ID(siteUrl) },
    inLanguage: 'en-GB',
  });
}

/* -------------------------------------------------------------------------- */
/*  Breadcrumbs                                                                */
/* -------------------------------------------------------------------------- */

export interface Crumb {
  name: string;
  path: string;
}

/**
 * The trail, always including Home.
 *
 * Emitted on every page including the ones with a one-item trail, because a
 * `BreadcrumbList` is how a result gets the path rendered under its title
 * instead of a raw URL, and an index page benefits from that as much as a
 * journey does.
 */
export function breadcrumbNode(siteUrl: string, crumbs: Crumb[]): Json {
  const all: Crumb[] = [{ name: 'Home', path: '/' }, ...crumbs];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: all.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: abs(siteUrl, crumb.path),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Questions and answers — **only** where the page renders them.
 *
 * The rule is not stylistic. `FAQPage` markup describing answers a visitor
 * cannot see on the page is the exact case Google's policy calls out, and the
 * penalty is the markup being ignored across the whole domain rather than on
 * the one page. So this takes the same array the page maps over.
 */
export function faqNode(faqs: ApiTripFaq[]): Json | null {
  if (faqs.length === 0) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  The journey                                                                */
/* -------------------------------------------------------------------------- */

const DIFFICULTY_NOTE: Record<string, string> = {
  Gentle: 'Gentle — short walks on made paths, no altitude above 3,200 m',
  Moderate: 'Moderate — full walking days, some ascent, altitude to 3,800 m',
  Demanding: 'Demanding — long days at altitude, passes above 4,500 m',
};

/**
 * A journey, as `TouristTrip`.
 *
 * The itinerary is an `ItemList` of `TouristDestination`, which is the part
 * that does real work: it is how the fourteen days of a Jomolhari trek become
 * fourteen addressable places rather than one blob of prose, and it is what an
 * assistant reads when somebody asks what the third day involves.
 *
 * Rest days are in the list. Skipping them would renumber everything after
 * them, and a rest day is a feature of these journeys rather than a gap.
 */
export function tripNode(
  siteUrl: string,
  trip: ApiTrip,
  site: ApiSite,
): Json {
  const url = abs(siteUrl, `/trips/${trip.slug}`);

  return clean({
    '@type': 'TouristTrip',
    '@id': `${url}#trip`,
    name: trip.title,
    description: trip.excerpt,
    url,
    image: imageNode(siteUrl, trip.heroImage),
    provider: { '@id': ORGANIZATION_ID(siteUrl) },
    touristType: touristTypeFor(trip.type),
    duration: isoDuration(trip.durationDays),
    /**
     * The `from` price, published as what it is.
     *
     * An `AggregateOffer` with a `lowPrice` is honest about a price that
     * varies with group size and season; an `Offer` with a `price` would claim
     * a fixed one and be contradicted by the first enquiry.
     */
    offers: clean({
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: trip.priceFromUsd,
      offerCount: Math.max(1, trip.departures.length),
      availability: trip.departures.some((d) => d.status !== 'CLOSED')
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      url,
      seller: { '@id': ORGANIZATION_ID(siteUrl) },
      description: `Includes the Sustainable Development Fee of US$${site.sdfPerNightUsd} per person per night.`,
    }),
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: trip.itinerary.length,
      itemListElement: trip.itinerary.map((day, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: clean({
          '@type': 'TouristDestination',
          name: day.title,
          description: day.body ?? day.meta ?? undefined,
        }),
      })),
    },
    subjectOf: trip.faq.length > 0 ? { '@type': 'FAQPage' } : undefined,
    /**
     * The facts a generative engine would otherwise have to infer from prose.
     *
     * A model asked "how high does the Jomolhari trek go" can lift 4930 from a
     * `PropertyValue` with a `unitCode`; from "a pass at 4,930 m" it has to
     * parse a sentence, and from "high" it has to guess.
     */
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Highest point',
        value: trip.highPointMetres,
        unitCode: 'MTR',
      },
      { '@type': 'PropertyValue', name: 'Nights', value: trip.nights },
      {
        '@type': 'PropertyValue',
        name: 'Difficulty',
        value: DIFFICULTY_NOTE[trip.difficulty] ?? trip.difficulty,
      },
      { '@type': 'PropertyValue', name: 'Best season', value: trip.seasonLabel },
      ...(trip.groupSizeMax
        ? [
            {
              '@type': 'PropertyValue',
              name: 'Group size',
              value: trip.groupSizeMin
                ? `${trip.groupSizeMin}–${trip.groupSizeMax}`
                : `up to ${trip.groupSizeMax}`,
            },
          ]
        : []),
    ],
    includesObject: trip.included.map((item) => ({
      '@type': 'TypeAndQuantityNode',
      typeOfGood: { '@type': 'Service', name: item },
      amountOfThisGood: 1,
    })),
    partOfTrip: undefined,
    arrivalLocation: trip.regions[0]
      ? { '@type': 'Place', name: `${trip.regions[0]}, Bhutan` }
      : undefined,
  });
}

function touristTypeFor(type: ApiTrip['type']): string[] {
  switch (type) {
    case 'mindfulness':
      return ['Mindfulness travellers', 'Cultural travellers'];
    case 'meditation':
      return ['Meditation practitioners', 'Retreat travellers'];
    case 'festival':
      return ['Cultural travellers', 'Festival travellers', 'Photographers'];
    case 'trekking':
      return ['Trekkers', 'Adventure travellers'];
  }
}

/* -------------------------------------------------------------------------- */
/*  Journal, destinations, culture                                             */
/* -------------------------------------------------------------------------- */

export function articleNode(siteUrl: string, post: ApiPost): Json {
  const url = abs(siteUrl, `/journal/${post.slug}`);
  return clean({
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.standfirst,
    url,
    image: imageNode(siteUrl, post.heroImage),
    datePublished: post.date,
    dateModified: post.seo.updatedAt,
    author: post.author
      ? clean({
          '@type': 'Person',
          name: post.author.name,
          jobTitle: post.author.role,
        })
      : { '@id': ORGANIZATION_ID(siteUrl) },
    publisher: { '@id': ORGANIZATION_ID(siteUrl) },
    isPartOf: { '@id': WEBSITE_ID(siteUrl) },
    inLanguage: 'en-GB',
    keywords: post.tags,
    about: post.region ? { '@type': 'Place', name: `${post.region}, Bhutan` } : undefined,
    timeRequired: `PT${Math.max(1, post.readingMinutes)}M`,
    /**
     * The standfirst, marked as the sentence worth reading aloud.
     *
     * `speakable` is what a voice assistant lifts when it answers out of this
     * page, and the standfirst is the one line on it written to stand alone.
     */
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.lp-standfirst'],
    },
  });
}

export function destinationNode(siteUrl: string, destination: ApiDestination): Json {
  const url = abs(siteUrl, `/destinations#${destination.slug}`);
  return clean({
    '@type': 'TouristDestination',
    '@id': `${url}`,
    name: destination.name,
    description: destination.detail || destination.blurb,
    url,
    image: imageNode(siteUrl, destination.image),
    geo:
      destination.latitude !== null && destination.longitude !== null
        ? {
            '@type': 'GeoCoordinates',
            latitude: destination.latitude,
            longitude: destination.longitude,
          }
        : undefined,
    containedInPlace: { '@type': 'Country', name: 'Bhutan' },
    includesAttraction: undefined,
    touristType: undefined,
  });
}

export function cultureNode(siteUrl: string, article: ApiCultureArticle): Json {
  const url = abs(siteUrl, `/culture#${article.slug}`);
  return clean({
    '@type': 'Article',
    '@id': url,
    headline: article.title,
    description: article.body.slice(0, 300),
    url,
    image: imageNode(siteUrl, article.image),
    publisher: { '@id': ORGANIZATION_ID(siteUrl) },
    isPartOf: { '@id': WEBSITE_ID(siteUrl) },
    inLanguage: 'en-GB',
  });
}

/** An index page's contents, so a crawler sees the set and not just the prose. */
export function tripListNode(siteUrl: string, trips: ApiTripSummary[]): Json {
  return {
    '@type': 'ItemList',
    numberOfItems: trips.length,
    itemListElement: trips.map((trip, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: abs(siteUrl, `/trips/${trip.slug}`),
      name: trip.title,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  The page graph — the one entry point                                       */
/* -------------------------------------------------------------------------- */

export interface PageGraphInput {
  siteUrl: string;
  site: ApiSite;
  /** This page's path, e.g. `/trips/valleys`. */
  path: string;
  title: string;
  description: string;
  crumbs: Crumb[];
  /** The page's own primary entity, from the builders above. */
  entity?: Json | null;
  /** Only the FAQs this page actually renders. */
  faqs?: ApiTripFaq[];
  image?: ApiImage | null;
  /** Hand-written JSON-LD from the SEO tab, merged last. */
  extra?: unknown;
}

/**
 * The single `@graph` a page emits.
 *
 * Everything else in this file feeds it. Nothing else should be rendered into
 * a `<script type="application/ld+json">` — a second script is a second,
 * unlinked description of the same page.
 */
export function pageGraph(input: PageGraphInput): Json {
  const { siteUrl, site, path, title, description, crumbs } = input;
  const url = abs(siteUrl, path);

  const webPage = clean({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: { '@id': WEBSITE_ID(siteUrl) },
    about: { '@id': ORGANIZATION_ID(siteUrl) },
    primaryImageOfPage: imageNode(siteUrl, input.image ?? null),
    inLanguage: 'en-GB',
    datePublished: undefined,
  });

  const graph: Json[] = [
    organizationNode(siteUrl, site),
    websiteNode(siteUrl, site),
    webPage,
    breadcrumbNode(siteUrl, crumbs),
  ];

  if (input.entity) graph.push(input.entity);

  const faq = faqNode(input.faqs ?? []);
  if (faq) graph.push(faq);

  if (input.extra && typeof input.extra === 'object') {
    graph.push(input.extra as Json);
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/* -------------------------------------------------------------------------- */
/*  Metadata helpers                                                           */
/* -------------------------------------------------------------------------- */

export interface ResolvedMeta {
  title: string;
  description: string;
  canonical: string;
  robots: { index: boolean; follow: boolean };
  openGraph: {
    title: string;
    description: string;
    url: string;
    image: ApiImage | null;
    type: 'website' | 'article';
  };
  twitter: { card: 'summary' | 'summary_large_image' };
  keywords: string[];
}

/**
 * The SEO block resolved against its fallbacks, in one place.
 *
 * Every entity carries an optional override for every field, and every page
 * would otherwise re-implement the same `metaTitle ?? title` chain slightly
 * differently. Doing it once means the admin's SEO preview can call this and
 * show what the page will actually emit rather than what the field holds.
 */
export function resolveMeta(args: {
  siteUrl: string;
  site: ApiSite;
  path: string;
  seo: ApiSeo;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackImage?: ApiImage | null;
  type?: 'website' | 'article';
}): ResolvedMeta {
  const { siteUrl, site, path, seo } = args;
  const title = seo.metaTitle?.trim() || args.fallbackTitle;
  const description = seo.metaDescription?.trim() || args.fallbackDescription;
  const image = seo.ogImage ?? args.fallbackImage ?? site.defaultSeo.ogImage ?? null;

  return {
    title,
    description,
    canonical: seo.canonicalUrl?.trim() || abs(siteUrl, path),
    robots: { index: !seo.noIndex, follow: !seo.noFollow },
    openGraph: {
      title: seo.ogTitle?.trim() || title,
      description: seo.ogDescription?.trim() || description,
      url: abs(siteUrl, path),
      image,
      type: args.type ?? 'website',
    },
    twitter: { card: seo.twitterCard },
    keywords: seo.keywords,
  };
}

/**
 * The template applied to a page title.
 *
 * `%s` is the page's own title. The home page passes null and gets
 * `defaultTitle`, because "Lotus Peak — Lotus Peak" is what a naive template
 * produces on the one page whose title is the site name.
 */
export function applyTitleTemplate(
  site: ApiSite,
  title: string | null,
): string {
  if (!title) return site.defaultSeo.defaultTitle;
  const template = site.defaultSeo.titleTemplate || '%s';
  return template.includes('%s') ? template.replace('%s', title) : `${title} ${template}`;
}

export * from './llms';
