import 'server-only'

import type {
  ApiActivity,
  ApiCultureArticle,
  ApiDestination,
  ApiEnquiryResult,
  ApiGalleryImage,
  ApiPage,
  ApiPerson,
  ApiPost,
  ApiPostSummary,
  ApiReflection,
  ApiSeason,
  ApiSite,
  ApiTrip,
  ApiTripSummary,
} from '@lotuspeak/api-contracts'

import { REVALIDATE_TAGS, fetchContent, fetchContentOrNull } from '../../api/client'
import type {
  ContentRepository,
  EnquiryInput,
  Redirect,
  SitemapEntry,
} from '../../repository'
import type { Activity, CultureArticle, Destination, GalleryImage, Post, Reflection, Season, SiteSettings, Trip } from '../../types'
import {
  toActivity,
  toCultureArticle,
  toDestination,
  toGalleryImage,
  toPage,
  toPerson,
  toPost,
  toPostSummary,
  toReflection,
  toSeason,
  toSettings,
  toTrip,
  toTripSummary,
} from './mappers'

/**
 * Content from the admin panel's public API.
 *
 * Implements the same `ContentRepository` the file provider did, so nothing in
 * `app/`, `src/sections/` or `src/design-system/` changed when this replaced
 * it. That was the point of the interface, and this is the first time it has
 * been tested.
 *
 * ## The catalogue is one request
 *
 * Destinations, activities, seasons, culture, the gallery, the reflections and
 * the people arrive together from `/catalogue`. The home page alone asks for
 * four of the seven; the alternative is four round trips and four cache
 * entries that can disagree about which publish they came from.
 *
 * The journeys and the journal are *not* in it, because those two grow without
 * bound and are the two that are filtered and limited.
 */
export function createApiProvider(): ContentRepository {
  /**
   * Nothing is memoised on the provider, deliberately.
   *
   * The obvious optimisation is to hold the catalogue and the site payload in
   * a promise on this closure, so the home page's four reads become one
   * request. It is also a bug, and an expensive one: `getContent()` caches the
   * provider in a module variable, so the closure outlives the request — it
   * lives as long as the process. Publishing would drop Next's cache entry,
   * the page would re-render, and the provider would hand it the same promise
   * it resolved when the server started. The site would show yesterday's
   * content until somebody restarted it, with every layer in between
   * reporting success.
   *
   * Next's own fetch cache does the job properly: identical requests inside
   * one render are deduplicated, entries are shared across requests, and
   * `revalidateTag` actually drops them.
   */
  const getCatalogue = (): Promise<Catalogue> =>
    fetchContent<Catalogue>('/api/public/site/catalogue', {
      tags: [
        REVALIDATE_TAGS.destinations,
        REVALIDATE_TAGS.activities,
        REVALIDATE_TAGS.seasons,
        REVALIDATE_TAGS.culture,
        REVALIDATE_TAGS.gallery,
        REVALIDATE_TAGS.reflections,
      ],
    })

  const getSite = (): Promise<ApiSite> =>
    fetchContent<ApiSite>('/api/public/site', { tags: [REVALIDATE_TAGS.site] })

  return {
    name: 'api',

    trips: {
      async list({ type, limit } = {}) {
        const rows = await fetchContent<ApiTripSummary[]>('/api/public/site/trips', {
          tags: [REVALIDATE_TAGS.trips],
          query: { type, limit },
        })
        return rows.map(toTripSummary)
      },

      async bySlug(slug) {
        const trip = await fetchContentOrNull<ApiTrip>(
          `/api/public/site/trips/${encodeURIComponent(slug)}`,
          { tags: [REVALIDATE_TAGS.trips] },
        )
        return trip ? toTrip(trip) : null
      },

      async slugs() {
        return fetchContent<string[]>('/api/public/site/trips', {
          tags: [REVALIDATE_TAGS.trips],
          query: { slugs: 1 },
        })
      },
    },

    posts: {
      async list({ limit, exclude } = {}) {
        const rows = await fetchContent<ApiPostSummary[]>('/api/public/site/journal', {
          tags: [REVALIDATE_TAGS.journal],
          query: { limit, exclude },
        })
        return rows.map(toPostSummary)
      },

      async bySlug(slug) {
        const post = await fetchContentOrNull<ApiPost>(
          `/api/public/site/journal/${encodeURIComponent(slug)}`,
          { tags: [REVALIDATE_TAGS.journal] },
        )
        return post ? toPost(post) : null
      },

      async slugs() {
        return fetchContent<string[]>('/api/public/site/journal', {
          tags: [REVALIDATE_TAGS.journal],
          query: { slugs: 1 },
        })
      },
    },

    destinations: {
      async list() {
        const { destinations } = await getCatalogue()
        return destinations.map(toDestination)
      },
      async bySlug(slug) {
        const { destinations } = await getCatalogue()
        const found = destinations.find((row) => row.slug === slug)
        return found ? toDestination(found, destinations.indexOf(found)) : null
      },
    },

    activities: {
      async list() {
        const { activities } = await getCatalogue()
        return activities.map(toActivity)
      },
    },

    gallery: {
      async list({ limit } = {}) {
        const { gallery } = await getCatalogue()
        const rows = gallery.map(toGalleryImage)
        return limit ? rows.slice(0, limit) : rows
      },
    },

    seasons: {
      async list() {
        const { seasons } = await getCatalogue()
        return seasons.map(toSeason)
      },
    },

    culture: {
      async list() {
        const { culture } = await getCatalogue()
        return culture.map(toCultureArticle)
      },
      async bySlug(slug) {
        const { culture } = await getCatalogue()
        const found = culture.find((row) => row.slug === slug)
        return found ? toCultureArticle(found, culture.indexOf(found)) : null
      },
    },

    reflections: {
      async list({ tripSlug, featured, limit } = {}) {
        const { reflections } = await getCatalogue()
        let rows = reflections
        /**
         * Filtered here rather than by asking the API.
         *
         * There are three of them. A query parameter would mean a second
         * request and a second cache entry to narrow a list the page already
         * holds — and the home page asks for the featured ones while the
         * About page asks for the rest, which would be two fetches of the
         * same three rows.
         */
        if (featured !== undefined) rows = rows.filter((row) => row.featured === featured)
        if (tripSlug) rows = rows.filter((row) => row.tripSlug === tripSlug)
        const mapped = rows.map((row, index) => toReflection(row, index))
        return limit ? mapped.slice(0, limit) : mapped
      },
    },

    pages: {
      async byPath(path) {
        const page = await fetchContentOrNull<ApiPage>('/api/public/site/pages', {
          tags: [REVALIDATE_TAGS.pages],
          query: { path },
        })
        return page ? toPage(page) : null
      },

      async list() {
        return fetchContent<{ path: string; title: string; lead: string | null }[]>(
          '/api/public/site/pages',
          { tags: [REVALIDATE_TAGS.pages] },
        )
      },
    },

    people: {
      async list() {
        const { people } = await getCatalogue()
        return people.map(toPerson)
      },
    },

    settings: {
      async get() {
        return toSettings(await getSite())
      },
    },

    discovery: {
      async sitemap() {
        return fetchContent<SitemapEntry[]>('/api/public/site/discovery', {
          tags: [REVALIDATE_TAGS.discovery],
          query: { part: 'sitemap' },
        })
      },

      async redirects() {
        return fetchContent<Redirect[]>('/api/public/site/discovery', {
          tags: [REVALIDATE_TAGS.redirects],
          query: { part: 'redirects' },
        })
      },

      async llmsTxt() {
        const { text } = await fetchContent<{ text: string }>('/api/public/site/discovery', {
          tags: [REVALIDATE_TAGS.discovery],
          query: { part: 'llms' },
        })
        return text
      },

      async llmsFullTxt() {
        const { text } = await fetchContent<{ text: string }>('/api/public/site/discovery', {
          tags: [REVALIDATE_TAGS.discovery],
          query: { part: 'llms-full' },
        })
        return text
      },
    },

    enquiries: {
      async create(input: EnquiryInput) {
        /**
         * The one write, and the one read that is never cached.
         *
         * `fetchContent` is not used: it tags and caches, and a POST that
         * landed in a cache entry would be a silently swallowed enquiry.
         */
        const response = await fetch(
          `${(process.env.CONTENT_API_URL ?? '').replace(/\/$/, '')}/api/public/enquiries`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(input),
            cache: 'no-store',
          },
        )

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null
          throw new Error(
            body?.error?.message ?? `The enquiry could not be recorded (${response.status}).`,
          )
        }

        const body = (await response.json()) as { data: ApiEnquiryResult }
        return { id: body.data.id }
      },
    },

    async health() {
      try {
        await getSite()
        return { ok: true }
      } catch (error) {
        return { ok: false, detail: (error as Error).message }
      }
    },
  }
}

interface Catalogue {
  destinations: ApiDestination[]
  activities: ApiActivity[]
  seasons: ApiSeason[]
  culture: ApiCultureArticle[]
  gallery: ApiGalleryImage[]
  reflections: ApiReflection[]
  people: ApiPerson[]
}

export type { Catalogue }
export type { ApiPage }
export type { Activity, CultureArticle, Destination, GalleryImage, Post, Reflection, Season, SiteSettings, Trip }
