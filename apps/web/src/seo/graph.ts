import 'server-only'

import { siteUrl } from '@/lib/env'

import {
  articleNode,
  breadcrumbNode,
  pageGraph,
  tripListNode,
  tripNode,
  type Crumb,
} from '@lotuspeak/seo'
import type {
  ApiImage,
  ApiPost,
  ApiSite,
  ApiTrip,
  ApiTripFaq,
  ApiTripSummary,
} from '@lotuspeak/api-contracts'

import { getContent } from '@/content'
import type { Post, SiteSettings, Trip } from '@/content/types'

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

function widenPost(post: Post): ApiPost {
  return {
    slug: post.slug,
    title: post.title,
    standfirst: post.standfirst,
    date: `${post.date}T00:00:00.000Z`,
    region: post.region,
    heroImage: image(post.heroImage, post.heroAlt),
    body: [],
    author: null,
    tags: [],
    relatedTripSlugs: [],
    readingMinutes: 1,
    seo: EMPTY_SEO,
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

/** A journal entry. */
export async function graphForPost(post: Post) {
  const settings = await getContent().settings.get()
  const site = await base(settings)
  const widened = widenPost(post)

  return pageGraph({
    siteUrl: siteUrl(),
    site,
    path: `/journal/${post.slug}`,
    title: post.title,
    description: post.standfirst,
    crumbs: [
      { name: 'Journal', path: '/journal' },
      { name: post.title, path: `/journal/${post.slug}` },
    ],
    entity: articleNode(siteUrl(), widened),
    image: widened.heroImage,
    extra: post.schemaJson,
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
