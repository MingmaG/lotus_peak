import 'server-only'

import { siteUrl } from '@/lib/env'

import {
  articleNode,
  breadcrumbNode,
  cultureNode,
  destinationNode,
  pageGraph,
  pageListNode,
  tripListNode,
  tripNode,
  type Crumb,
} from '@lotuspeak/seo'
import type {
  ApiCultureArticle,
  ApiCultureSummary,
  ApiDestination,
  ApiDestinationSummary,
  ApiImage,
  ApiPost,
  ApiPostSummary,
  ApiSite,
  ApiTrip,
  ApiTripFaq,
  ApiTripSummary,
} from '@lotuspeak/api-contracts'

import { getContent } from '@/content'
import type {
  CultureArticle,
  CulturePage,
  Destination,
  DestinationPage,
  EntitySeo,
  Post,
  PostPage,
  SiteSettings,
  Trip,
} from '@/content/types'

/**
 * Builds a page's structured data.
 *
 * The site's domain types are narrower than the wire types `@lotuspeak/seo`
 * takes — a component holds `image: string` because it renders one `<img>` —
 * so this widens them back on the way to the graph. That is the cost of
 * keeping the API's vocabulary out of the design system, and it is paid once,
 * here, rather than in every page.
 */

/**
 * The company, as the graph builder wants it.
 *
 * Most of it comes straight from the settings the layout already has. What is
 * *not* here is the address in parts, the coordinates and the social links:
 * the site's own `SiteSettings` never needed them, so this reads the API's
 * richer payload for the fields only a crawler uses.
 */
async function apiSite(): Promise<ApiSite | null> {
  const url = process.env.CONTENT_API_URL
  if (!url) return null
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/public/site`, {
      next: { tags: ['site'], revalidate: 3600 },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { data: ApiSite }
    return body.data
  } catch {
    /* Structured data is an enhancement. A page that cannot build it renders
       without it rather than failing — which is the opposite of the rule for
       content, and right for the same reason: nobody reads this but a robot. */
    return null
  }
}

const EMPTY_SEO = {
  metaTitle: null,
  metaDescription: null,
  canonicalUrl: null,
  noIndex: false,
  noFollow: false,
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  twitterCard: 'summary_large_image' as const,
  keywords: [],
  schemaJson: null,
  sitemapPriority: 0.5,
  sitemapChangeFreq: 'monthly' as const,
  updatedAt: new Date().toISOString(),
}

function image(src: string, alt: string | undefined): ApiImage | null {
  if (!src) return null
  return {
    id: src,
    url: src.startsWith('http') ? src : `${siteUrl()}${src}`,
    alt: alt ?? '',
    width: 1200,
    height: 800,
    blurDataUrl: null,
    focal: [0.5, 0.5],
    decorative: !alt,
    caption: null,
    credit: null,
  }
}

function widenTrip(trip: Trip): ApiTrip {
  return {
    slug: trip.slug,
    title: trip.title,
    excerpt: trip.excerpt,
    type: trip.type,
    regions: trip.regions,
    destinationSlugs: [],
    durationDays: trip.durationDays,
    nights: trip.nights,
    highPointMetres: trip.highPointMetres,
    difficulty: trip.difficulty,
    priceFromUsd: trip.priceFromUsd,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    faqGroups: [],
    seasonLabel: trip.seasonLabel,
    seasonKeys: [],
    paceNote: trip.paceNote,
    journeyLabel: trip.journeyLabel,
    groupSizeMin: null,
    groupSizeMax: null,
    heroImage: image(trip.heroImage, trip.heroAlt),
    overview: trip.overview,
    highlights: trip.highlights,
    itinerary: trip.itinerary.map((day, index) => ({
      day: day.rest ? null : index + 1,
      rest: day.rest === true,
      title: day.title,
      meta: day.meta ?? null,
      body: day.body ?? null,
      images: [],
    })),
    included: trip.included,
    excluded: trip.excluded,
    faq: trip.faq,
    gallery: [],
    departures: [],
    relatedSlugs: [],
    featured: false,
    seo: EMPTY_SEO,
  }
}

function widenSeo(seo: EntitySeo) {
  return { ...EMPTY_SEO, updatedAt: seo.updatedAt ?? EMPTY_SEO.updatedAt }
}

function widenDestination(row: Destination): ApiDestinationSummary {
  return {
    slug: row.slug,
    name: row.name,
    path: row.path,
    parentSlug: row.parentSlug,
    icon: row.icon,
    blurb: row.blurb,
    standfirst: row.standfirst,
    image: image(row.image, row.imageAlt),
    tripSlugs: row.tripSlugs,
    altitudeMetres: row.altitudeMetres,
    latitude: row.latitude,
    longitude: row.longitude,
    places: row.places,
  }
}

function widenCulture(row: CultureArticle): ApiCultureSummary {
  return {
    slug: row.slug,
    title: row.title,
    path: row.path,
    standfirst: row.standfirst,
    icon: row.icon,
    image: image(row.image, row.imageAlt),
  }
}

function widenPostSummary(row: Post): ApiPostSummary {
  return {
    slug: row.slug,
    title: row.title,
    path: row.path,
    standfirst: row.standfirst,
    date: `${row.date}T00:00:00.000Z`,
    category: row.category,
    places: row.places,
    heroImage: image(row.heroImage, row.heroAlt),
    readingMinutes: row.readingMinutes,
  }
}

function widenPost(post: PostPage): ApiPost {
  return {
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    date: `${post.date}T00:00:00.000Z`,
    category: post.category,
    heroImage: image(post.heroImage, post.heroAlt),
    body: '',
    author: post.author ? { ...post.author, avatar: null } : null,
    tags: post.tags,
    relatedTripSlugs: post.relatedTripSlugs,
    destinations: post.destinations.map(widenDestination),
    culture: post.culture.map(widenCulture),
    readingMinutes: post.readingMinutes,
    seo: widenSeo(post.seo),
  }
}

async function base(settings: SiteSettings): Promise<ApiSite> {
  const fromApi = await apiSite()
  if (fromApi) return fromApi

  /* The file provider, or an unreachable API. Enough for a valid graph. */
  return {
    company: {
      legalName: settings.brand,
      name: settings.brand,
      tagline: settings.line,
      description: settings.defaultSeo.description,
      foundedYear: null,
      licenceNumber: null,
      registrationNumber: null,
      logo: null,
      markLogo: null,
      address: {
        line1: '',
        line2: null,
        locality: 'Thimphu',
        region: null,
        postalCode: null,
        country: 'Bhutan',
        countryCode: 'BT',
        latitude: null,
        longitude: null,
        mapUrl: null,
      },
      contacts: [
        {
          kind: 'MOBILE',
          label: 'Telephone',
          value: settings.contact.phone.replace(/\s+/g, ''),
          display: settings.contact.phone,
          isPrimary: true,
          prefillMessage: null,
        },
        {
          kind: 'EMAIL',
          label: 'Email',
          value: settings.contact.email,
          display: settings.contact.email,
          isPrimary: true,
          prefillMessage: null,
        },
      ],
      socials: [],
      officeHours: [],
    },
    nav: [],
    navCta: null,
    footer: { columns: [], note: settings.footer.note, copyright: '' },
    replyPromise: settings.contact.replyPromise,
    pledge: { percent: settings.pledge.percent, beneficiary: settings.pledge.beneficiary, note: null },
    sdfPerNightUsd: settings.sdfPerNightUsd,
    defaultSeo: {
      titleTemplate: '%s — Lotus Peak',
      defaultTitle: settings.defaultSeo.title,
      description: settings.defaultSeo.description,
      ogImage: null,
    },
    siteUrl: siteUrl(),
    integrations: {
      googleAnalyticsId: null,
      googleTagManagerId: null,
      googleSiteVerification: null,
      metaPixelId: null,
      whatsappNumber: null,
      whatsappPrefill: null,
      tripadvisorWidgetId: null,
    },
    announcement: null,
  }
}

/** The organisation, the site, this page and its trail. Everything renders one. */
export async function graphForPage(args: {
  path: string
  title: string
  description: string
  crumbs: Crumb[]
  faqs?: ApiTripFaq[]
  /**
   * The `schemaJson` column from this record's SEO tab.
   *
   * Every caller passes it, including the ones that have nothing to pass —
   * `undefined` is the same as an empty field, and a builder that quietly
   * drops it is how a field the office filled in never appears on the page.
   */
  extra?: unknown
}) {
  const settings = await getContent().settings.get()
  const site = await base(settings)

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: args.path,
    title: args.title,
    description: args.description,
    crumbs: args.crumbs,
    faqs: args.faqs,
    extra: args.extra,
  })
}

/** A journey: the page graph, plus `TouristTrip` and its questions. */
export async function graphForTrip(trip: Trip) {
  const settings = await getContent().settings.get()
  const site = await base(settings)
  const widened = widenTrip(trip)

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: `/trips/${trip.slug}`,
    title: trip.title,
    description: trip.excerpt,
    crumbs: [
      { name: 'Our trips', path: '/trips' },
      { name: trip.title, path: `/trips/${trip.slug}` },
    ],
    entity: tripNode(siteUrl(), widened, site),
    extra: trip.schemaJson,
    /* Only the questions this page actually renders. Markup describing
       answers a visitor cannot see is the one case the policy calls out, and
       the penalty falls on the whole domain. */
    faqs: trip.faq,
    image: widened.heroImage,
  })
}

/** A journal entry: the page graph, plus the `Article` and what it is about. */
export async function graphForPost(post: PostPage) {
  const settings = await getContent().settings.get()
  const site = await base(settings)
  const widened = widenPost(post)

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: post.path,
    title: post.seo.title ?? post.title,
    description: post.seo.description ?? post.standfirst,
    crumbs: [
      { name: 'Journal', path: '/journal' },
      { name: post.title, path: post.path },
    ],
    entity: articleNode(siteUrl(), widened),
    image: widened.heroImage,
    extra: post.seo.schemaJson,
  })
}

/**
 * A valley or a place: `TouristDestination`, or `TouristAttraction` inside
 * its valley, and a trail that goes through the valley.
 */
export async function graphForDestination(page: DestinationPage) {
  const settings = await getContent().settings.get()
  const site = await base(settings)

  const widened: ApiDestination = {
    ...widenDestination(page),
    body: '',
    parent: page.parent,
    placeCards: page.placeCards.map(widenDestination),
    culture: page.culture.map(widenCulture),
    posts: page.posts.map(widenPostSummary),
    seo: widenSeo(page.seo),
  }

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: page.path,
    title: page.seo.title ?? page.name,
    description: page.seo.description ?? (page.standfirst || page.blurb),
    crumbs: [
      { name: 'Where we go', path: '/destinations' },
      ...(page.parent ? [{ name: page.parent.title, path: page.parent.path }] : []),
      { name: page.name, path: page.path },
    ],
    entity: destinationNode(siteUrl(), widened),
    image: widened.image,
    extra: page.seo.schemaJson,
  })
}

/** A culture piece: the page graph, plus its `Article` and where to see it. */
export async function graphForCulture(page: CulturePage) {
  const settings = await getContent().settings.get()
  const site = await base(settings)

  const widened: ApiCultureArticle = {
    ...widenCulture(page),
    body: '',
    destinations: page.destinations.map(widenDestination),
    posts: page.posts.map(widenPostSummary),
    seo: widenSeo(page.seo),
  }

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: page.path,
    title: page.seo.title ?? page.title,
    description: page.seo.description ?? page.standfirst,
    crumbs: [
      { name: 'Culture', path: '/culture' },
      { name: page.title, path: page.path },
    ],
    entity: cultureNode(siteUrl(), widened),
    image: widened.image,
    extra: page.seo.schemaJson,
  })
}

/**
 * An index of pages — Where we go, Culture, a journal shelf — with the set it
 * lists as an `ItemList`, so a crawler sees the pages and not only the prose.
 */
export async function graphForIndex(args: {
  path: string
  title: string
  description: string
  crumbs: Crumb[]
  items: { path: string; name: string }[]
  extra?: unknown
}) {
  const settings = await getContent().settings.get()
  const site = await base(settings)

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: args.path,
    title: args.title,
    description: args.description,
    crumbs: args.crumbs,
    entity: args.items.length ? pageListNode(siteUrl(), args.items) : null,
    extra: args.extra,
  })
}

/** The journeys index: the page graph, plus the set it lists. */
export async function graphForTripIndex(trips: Trip[]) {
  const settings = await getContent().settings.get()
  const site = await base(settings)

  const summaries: ApiTripSummary[] = trips.map((trip) => ({
    slug: trip.slug,
    title: trip.title,
    excerpt: trip.excerpt,
    type: trip.type,
    regions: trip.regions,
    durationDays: trip.durationDays,
    nights: trip.nights,
    highPointMetres: trip.highPointMetres,
    difficulty: trip.difficulty,
    priceFromUsd: trip.priceFromUsd,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    faqGroups: [],
    seasonLabel: trip.seasonLabel,
    journeyLabel: trip.journeyLabel,
    heroImage: image(trip.heroImage, trip.heroAlt),
    featured: false,
  }))

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: '/trips',
    title: 'Our journeys',
    description: settings.defaultSeo.description,
    crumbs: [{ name: 'Our trips', path: '/trips' }],
    entity: tripListNode(siteUrl(), summaries),
  })
}

export { breadcrumbNode }
