import { renderStoredRichText } from '@/lib/rich-text'
import { siteUrl } from '@/lib/env'
import 'server-only'

import { buildLlmsFullTxt, buildLlmsTxt } from '@lotuspeak/seo'
import type { ApiImage, ApiSite } from '@lotuspeak/api-contracts'

import { IMG, altFor } from '@/lib/assets'
import {
  ABOUT_PURPOSES,
  HOME_PURPOSES,
  COMMITMENTS,
  TERMS_SECTIONS,
  TRAVELLER_SECTIONS,
  type InfoSection,
} from '../data/pages'
import { ACTIVITIES, GALLERY, REFLECTIONS, SEASONS, SETTINGS } from '../data/site'
import {
  fileCultureList,
  fileCulturePage,
  fileDestinationList,
  fileDestinationPage,
  filePosts,
} from './file-sections'
import { TRIPS, type TripRecord } from '../data/trips'
import type { ContentRepository, EnquiryInput } from '../repository'
import type { Activity, GalleryImage, PageBand, Season, SitePage, Trip } from '../types'

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order

/**
 * Fills in the alt text this provider's records keep in a side table.
 *
 * `src/lib/assets.ts` holds one description per photograph, keyed by its path,
 * and until the content moved into a database every component looked it up
 * there. Client components cannot — `TrekCard`, `Strip` and the two heroes are
 * all `'use client'`, and the lookup table is a server module — so the
 * description travels on the record now. This is where the file provider
 * joins the two, so both providers hand out the same shape and the file
 * provider stays the fixture the API provider is checked against.
 */
const withAlt = {
  trip: (trip: TripRecord): Trip => ({
    ...trip,
    heroAlt: altFor(trip.heroImage),
    gallery: trip.gallery.map(([src]) => ({
      src,
      alt: altFor(src),
      caption: null,
      credit: null,
      width: null,
      height: null,
      focal: [0.5, 0.5],
    })),
    sections: { gallery: true, destinations: true, culture: true, journal: true, related: true },
    destinations: [],
    culture: [],
    posts: [],
    related: [],
  }),
  activity: (row: Activity): Activity => ({ ...row, imageAlt: altFor(row.image) }),
  season: (row: Season): Season => ({ ...row, imageAlt: altFor(row.image) }),
  gallery: (row: GalleryImage): GalleryImage => ({ ...row, alt: altFor(row.src) }),
}

/**
 * The bands at the foot of a journey, joined the way the admin panel joins
 * them when the office has chosen nothing: the places whose journeys include
 * it, the culture linked to those places, and the next few journeys in order.
 *
 * The journal is empty in this provider — see `filePosts` — so `posts` is too.
 */
function fileTripLinks(slug: string): Pick<Trip, 'destinations' | 'culture' | 'posts' | 'related'> {
  /* Valleys only: a place inherits its valley's journeys, so filtering the
     whole list would put every place in Paro on the route of every journey
     through it. */
  const destinations = fileDestinationList().filter(
    (d) => !d.parentSlug && d.tripSlugs.includes(slug),
  )
  const route = new Set(destinations.map((d) => d.slug))
  const culture = fileCultureList()
    .filter((c) => fileCulturePage(c.slug)?.destinations.some((d) => route.has(d.slug)))
    .slice(0, 3)

  const catalogue = [...TRIPS].sort(byOrder)
  const at = catalogue.findIndex((t) => t.slug === slug)
  const related = [...catalogue.slice(at + 1), ...catalogue.slice(0, at)]
    .slice(0, 3)
    .map(withAlt.trip)

  return { destinations, culture, posts: [], related }
}

/**
 * The file provider: content compiled into the bundle from src/content/data.
 *
 * Zero infrastructure — the site is fully functional, deployable and demoable
 * before any database exists. It stays supported forever as the reference
 * implementation and the fixture a new provider is checked against.
 */

/* -------------------------------------------------------------------------- */
/*  Discovery                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The site's fixed routes, for this provider's sitemap.
 *
 * A literal list, which is exactly what the database version replaces — and
 * correct here, because with no database there is no `pages` table to read and
 * the routes are the ones this repository actually ships.
 */
const FILE_PAGES = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1 },
  { path: '/trips', changeFrequency: 'weekly' as const, priority: 0.9 },
  { path: '/destinations', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/activities', changeFrequency: 'monthly' as const, priority: 0.6 },
  { path: '/journal', changeFrequency: 'weekly' as const, priority: 0.7 },
  { path: '/gallery', changeFrequency: 'monthly' as const, priority: 0.4 },
  { path: '/culture', changeFrequency: 'monthly' as const, priority: 0.6 },
  { path: '/about', changeFrequency: 'yearly' as const, priority: 0.7 },
  { path: '/contact', changeFrequency: 'yearly' as const, priority: 0.8 },
  { path: '/travellers-information', changeFrequency: 'yearly' as const, priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.3 },
]

const SITE_URL = siteUrl()

/**
 * This provider's data, in the shapes `@lotuspeak/seo` builds from.
 *
 * An adapter rather than a second implementation of `llms.txt`. Two builders
 * would be two files that describe the same site differently — which is the
 * failure the shared package exists to prevent, and it would be no less a
 * failure for being between two providers rather than between two apps.
 */
function fileImage(src: string): ApiImage | null {
  const record = altFor(src)
  return src
    ? {
        id: src,
        url: `${SITE_URL}${src}`,
        alt: record,
        width: 1200,
        height: 800,
        blurDataUrl: null,
        focal: [0.5, 0.5],
        decorative: record === '',
        caption: null,
        credit: null,
      }
    : null
}

function fileSite(): ApiSite {
  const s = SETTINGS
  return {
    company: {
      legalName: s.legalName,
      name: s.brand,
      tagline: s.line,
      description: s.defaultSeo.description,
      foundedYear: null,
      licenceNumber: null,
      registrationNumber: null,
      logo: null,
      markLogo: null,
      address: {
        line1: s.address.lines[0] ?? 'Thimphu',
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
          value: s.contact.phone.replace(/\s+/g, ''),
          display: s.contact.phone,
          isPrimary: true,
          prefillMessage: null,
        },
        {
          kind: 'EMAIL',
          label: 'Email',
          value: s.contact.email,
          display: s.contact.email,
          isPrimary: true,
          prefillMessage: null,
        },
      ],
      socials: s.socials.map((social) => ({ ...social, handle: null })),
      officeHours: [],
    },
    nav: s.nav.map((link) => ({ ...link, external: false, children: [] })),
    navCta: s.navCta,
    footer: {
      columns: s.footer.columns.map((column) => ({
        title: column.title,
        links: column.links.map((link) => ({ ...link, external: false, children: [] })),
      })),
      note: s.footer.note,
      copyright: '© {year} {name}',
      credit: s.footer.credit,
      show: s.footer.show,
    },
    journeyBands: s.journeyBands,
    replyPromise: s.contact.replyPromise,
    pledge: { percent: s.pledge.percent, beneficiary: s.pledge.beneficiary, note: null },
    sdfPerNightUsd: s.sdfPerNightUsd,
    defaultSeo: {
      titleTemplate: '%s — Lotus Peak',
      defaultTitle: s.defaultSeo.title,
      description: s.defaultSeo.description,
      ogImage: null,
    },
    siteUrl: SITE_URL,
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

function fileTripSummaries() {
  return [...TRIPS].sort(byOrder).map((trip) => ({
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
    heroImage: fileImage(trip.heroImage),
    featured: false,
  }))
}

const FILE_SEO = {
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
  updatedAt: new Date(0).toISOString(),
}

function fileLlmsInput() {
  return {
    siteUrl: SITE_URL,
    site: fileSite(),
    trips: fileTripSummaries(),
    posts: filePosts().map((post) => ({
      slug: post.slug,
      title: post.title,
      standfirst: post.standfirst,
    })),
    destinations: fileDestinationList(),
    culture: fileCultureList(),
    pages: FILE_PAGES.filter((page) => page.priority >= 0.5).map((page) => ({
      path: page.path,
      title: page.path === '/' ? 'Home' : page.path.replace('/', '').replace(/-/g, ' '),
      lead: null,
    })),
  }
}

function fileLlmsFullInput() {
  return {
    siteUrl: SITE_URL,
    site: fileSite(),
    trips: [...TRIPS].sort(byOrder).map((trip) => ({
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
      heroImage: fileImage(trip.heroImage),
      overview: trip.overview,
      highlights: trip.highlights,
      itinerary: trip.itinerary.map((day, index) => ({
        day: day.rest ? null : index + 1,
        rest: day.rest === true,
        title: day.title,
        meta: day.meta ?? null,
        body: day.body ? renderStoredRichText(day.body) : null,
        images: [],
      })),
      included: trip.included,
      excluded: trip.excluded,
      faq: trip.faq,
      gallery: [],
      departures: [],
      sections: { gallery: true, destinations: true, culture: true, journal: true, related: true },
      destinations: [],
      culture: [],
      posts: [],
      related: [],
      featured: false,
      seo: FILE_SEO,
    })),
    /* The journal is empty here; see `filePosts`. */
    posts: [],
    destinations: fileDestinationList().flatMap((row) => {
      const page = fileDestinationPage(row.slug)
      return page ? [toApiDestination(page)] : []
    }),
    culture: fileCultureList().flatMap((row) => {
      const page = fileCulturePage(row.slug)
      return page
        ? [
            {
              slug: page.slug,
              title: page.title,
              path: page.path,
              standfirst: page.standfirst,
              icon: page.icon,
              image: fileImage(page.image),
              body: page.body,
              destinations: [],
              posts: [],
              seo: FILE_SEO,
            },
          ]
        : []
    }),
  }
}

/** A destination page in the wire shape, for `llms-full.txt`. */
function toApiDestination(page: NonNullable<ReturnType<typeof fileDestinationPage>>) {
  const summary = (row: typeof page | (typeof page.placeCards)[number]) => ({
    slug: row.slug,
    name: row.name,
    path: row.path,
    parentSlug: row.parentSlug,
    icon: row.icon,
    blurb: row.blurb,
    standfirst: row.standfirst,
    image: fileImage(row.image),
    tripSlugs: row.tripSlugs,
    altitudeMetres: row.altitudeMetres,
    latitude: row.latitude,
    longitude: row.longitude,
    places: row.places,
  })
  return {
    ...summary(page),
    body: page.body,
    parent: page.parent,
    placeCards: page.placeCards.map(summary),
    culture: [],
    posts: [],
    seo: FILE_SEO,
  }
}

/* -------------------------------------------------------------------------- */
/*  Editorial pages                                                            */
/* -------------------------------------------------------------------------- */

/** An `InfoSection` becomes one prose band, exactly as the export script does. */
function fromInfoSection(section: InfoSection): PageBand {
  const body = section.body
    .map((block) =>
      typeof block === 'string'
        ? `<p>${escapeHtml(block)}</p>`
        : `<ul>${block.list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    )
    .join('\n')
  /* Through the sanitiser like every other band, although this one is built
     here out of escaped text and could not contain anything it would remove.
     What matters is that a band leaving *either* provider has been rebuilt
     exactly once — the renderers rely on that, and one of them used to run it
     a second time and quietly destroy the film façades it found. */
  return {
    kind: 'prose',
    eyebrow: null,
    title: section.title,
    body: renderStoredRichText(body),
    anchor: section.id,
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const FILE_SEO_META = { title: null, description: null, noIndex: false }

const FILE_PAGES_CONTENT: Record<string, SitePage> = {
  '/': {
    slug: 'home',
    path: '/',
    title: 'Lotus Peak',
    eyebrow: 'Our purpose',
    lead: 'We are a small Bhutanese company. We share the practice of awareness in a country where it still shapes daily life.',
    note: null,
    heroImage: IMG.hero,
    heroAlt: altFor(IMG.hero),
    bands: [
      {
        kind: 'points',
        eyebrow: 'Our purpose',
        title: 'Mindful journeys in Bhutan',
        lead: null,
        points: HOME_PURPOSES.map(([title, body]) => ({ title, body: `<p>${escapeHtml(body)}</p>`, icon: null })),
      },
      {
        kind: 'trips',
        eyebrow: 'Our trips',
        title: 'Four journeys, each with time to spare',
        lead: null,
        tripSlugs: [],
      },
    ],
    seo: FILE_SEO_META,
  },

  '/about': {
    slug: 'about',
    path: '/about',
    title: 'About Lotus Peak',
    eyebrow: 'About',
    lead: 'A small Bhutanese company, sharing the practice of awareness in the country where it still shapes daily life.',
    note: null,
    heroImage: IMG.courtyard,
    heroAlt: altFor(IMG.courtyard),
    bands: [
      ...ABOUT_PURPOSES.flatMap<PageBand>(([title, body, image]) => [
        {
          kind: 'figure' as const,
          src: image,
          alt: altFor(image),
          caption: null,
          width: 'inset' as const,
        },
        { kind: 'prose' as const, eyebrow: null, title, body: `<p>${escapeHtml(body)}</p>`, anchor: null },
      ]),
      {
        kind: 'points',
        eyebrow: 'What we hold to',
        title: 'Our commitments',
        lead: null,
        points: COMMITMENTS.map(([title, body]) => ({ title, body, icon: null })),
      },
      {
        kind: 'cta',
        title: 'Come and see',
        lead: 'Tell us what you are hoping for and we will write back personally.',
        label: 'Make an enquiry',
        href: '/contact',
        band: true,
      },
    ],
    seo: FILE_SEO_META,
  },

  '/terms': {
    slug: 'terms',
    path: '/terms',
    title: 'Terms & conditions',
    eyebrow: 'Terms',
    lead: 'The terms on which we sell and operate our journeys. The figures particular to your booking — deposit, balance date and the cancellation scale — are in the written confirmation we send you.',
    note: 'Last revised for the 2026 season.',
    heroImage: null,
    heroAlt: undefined,
    bands: TERMS_SECTIONS.map(fromInfoSection),
    seo: FILE_SEO_META,
  },

  '/travellers-information': {
    slug: 'travellers-information',
    path: '/travellers-information',
    title: 'What to know before you come',
    eyebrow: 'Travellers',
    lead: 'Not a complete list — the things travellers ask us most. Anything specific to your journey is in the notes we send when it is booked.',
    note: 'Last reviewed for the 2026 season. Ask us if you are reading this later than that.',
    heroImage: null,
    heroAlt: undefined,
    bands: TRAVELLER_SECTIONS.map(fromInfoSection),
    seo: FILE_SEO_META,
  },
}

export function createFileProvider(): ContentRepository {
  return {
    name: 'file',

    trips: {
      async list({ type, featured, limit } = {}) {
        let out = [...TRIPS].sort(byOrder)
        if (type) out = out.filter((t) => t.type === type)
        /* The fixture marks no journey as featured, so asking for them gets
           none — and the home page's fall-back to catalogue order is what the
           fixture exercises. */
        if (featured) out = []
        return (limit ? out.slice(0, limit) : out).map(withAlt.trip)
      },
      async bySlug(slug) {
        const trip = TRIPS.find((t) => t.slug === slug)
        return trip ? { ...withAlt.trip(trip), ...fileTripLinks(trip.slug) } : null
      },
      async slugs() {
        return [...TRIPS].sort(byOrder).map((t) => t.slug)
      },
    },

    posts: {
      async list({ limit, exclude, category } = {}) {
        let out = filePosts()
        if (exclude) out = out.filter((p) => p.slug !== exclude)
        if (category) out = out.filter((p) => p.category === category)
        return limit ? out.slice(0, limit) : out
      },
      async bySlug() {
        return null
      },
      async slugs() {
        return filePosts().map((p) => p.slug)
      },
    },

    destinations: {
      async list() {
        return fileDestinationList()
      },
      async bySlug(slug) {
        return fileDestinationPage(slug)
      },
    },

    activities: {
      async list() {
        return [...ACTIVITIES].sort(byOrder).map(withAlt.activity)
      },
    },

    gallery: {
      async list({ limit } = {}) {
        const out = [...GALLERY].sort(byOrder).map(withAlt.gallery)
        return limit ? out.slice(0, limit) : out
      },
    },

    seasons: {
      async list() {
        return [...SEASONS].sort(byOrder).map(withAlt.season)
      },
    },

    culture: {
      async list() {
        return fileCultureList()
      },
      async bySlug(slug) {
        return fileCulturePage(slug)
      },
    },

    reflections: {
      async list({ tripSlug, featured, limit } = {}) {
        let out = [...REFLECTIONS].sort(byOrder)
        if (tripSlug) out = out.filter((r) => r.tripSlug === tripSlug)
        if (featured !== undefined) out = out.filter((r) => r.featured === featured)
        return limit ? out.slice(0, limit) : out
      },
    },

    /**
     * The discovery surface, built here from the same modules everything else
     * in this provider reads.
     *
     * It duplicates what the admin panel's `/discovery` endpoint does, which
     * is the price of keeping the file provider a genuine fixture: a provider
     * that implemented nine of eleven methods and threw on the other two would
     * not prove anything about whether a page is coupled to a source.
     */
    discovery: {
      async sitemap() {
        const now = new Date().toISOString()
        return [
          ...FILE_PAGES.map((page) => ({ ...page, lastModified: now })),
          ...[...TRIPS].sort(byOrder).map((trip) => ({
            path: `/trips/${trip.slug}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
          })),
          ...fileDestinationList().map((row) => ({
            path: row.path,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: row.parentSlug ? 0.6 : 0.7,
          })),
          ...fileCultureList().map((row) => ({
            path: row.path,
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          })),
        ]
      },

      /* The file provider has no redirect table. An empty list is the truth,
         not a stub: with no database there is nowhere for one to live. */
      async redirects() {
        return []
      },

      async llmsTxt() {
        return buildLlmsTxt(fileLlmsInput())
      },

      async llmsFullTxt() {
        return buildLlmsFullTxt(fileLlmsFullInput())
      },
    },

    /**
     * The editorial pages, composed from `src/content/data/pages.ts`.
     *
     * The staging post that copy moved into on its way out of the React
     * components. This provider is the last thing reading it; when it goes, so
     * does the file.
     */
    pages: {
      async byPath(path) {
        return FILE_PAGES_CONTENT[path] ?? null
      },
      async list() {
        return Object.values(FILE_PAGES_CONTENT).map((page) => ({
          path: page.path,
          title: page.title,
          lead: page.lead,
        }))
      },
    },

    /* No people in the file provider's data. An empty list is the truth. */
    people: {
      async list() {
        return []
      },
    },

    settings: {
      async get() {
        return SETTINGS
      },
    },

    enquiries: {
      async create(input: EnquiryInput) {
        // No backend yet. The enquiry is logged server-side so nothing is lost
        // in development, and the mail adapter takes over in phase 5
        // (docs/specs/08-forms-and-enquiries.md).
        const id = `enq_${Date.now().toString(36)}`
        console.info('[enquiry]', id, JSON.stringify(input))
        return { id }
      },
    },

    async health() {
      const places = fileDestinationList()
      return {
        ok: TRIPS.length > 0 && places.length > 0,
        detail: `${TRIPS.length} journeys, ${places.length} places`,
      }
    },
  }
}
