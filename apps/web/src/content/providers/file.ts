import 'server-only'

import { altFor } from '@/lib/assets'
import { ACTIVITIES, CULTURE, DESTINATIONS, GALLERY, REFLECTIONS, SEASONS, SETTINGS } from '../data/site'
import { POSTS } from '../data/posts'
import { TRIPS } from '../data/trips'
import type { ContentRepository, EnquiryInput } from '../repository'
import type { Activity, CultureArticle, Destination, GalleryImage, Post, Season, Trip } from '../types'

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
  trip: (trip: Trip): Trip => ({
    ...trip,
    heroAlt: altFor(trip.heroImage),
    gallery: trip.gallery.map(
      ([src, ratio, width]) => [src, ratio, width, altFor(src)] as [string, string?, string?, string?],
    ),
  }),
  post: (post: Post): Post => ({
    ...post,
    heroAlt: altFor(post.heroImage),
    body: post.body.map((block) =>
      block.kind === 'image' ? { ...block, alt: altFor(block.src) } : block,
    ),
  }),
  destination: (row: Destination): Destination => ({ ...row, imageAlt: altFor(row.image) }),
  activity: (row: Activity): Activity => ({ ...row, imageAlt: altFor(row.image) }),
  season: (row: Season): Season => ({ ...row, imageAlt: altFor(row.image) }),
  culture: (row: CultureArticle): CultureArticle => ({ ...row, imageAlt: altFor(row.image) }),
  gallery: (row: GalleryImage): GalleryImage => ({ ...row, alt: altFor(row.src) }),
}

/**
 * The file provider: content compiled into the bundle from src/content/data.
 *
 * Zero infrastructure — the site is fully functional, deployable and demoable
 * before any database exists. It stays supported forever as the reference
 * implementation and the fixture a new provider is checked against.
 */
export function createFileProvider(): ContentRepository {
  return {
    name: 'file',

    trips: {
      async list({ type, limit } = {}) {
        let out = [...TRIPS].sort(byOrder)
        if (type) out = out.filter((t) => t.type === type)
        return (limit ? out.slice(0, limit) : out).map(withAlt.trip)
      },
      async bySlug(slug) {
        const trip = TRIPS.find((t) => t.slug === slug)
        return trip ? withAlt.trip(trip) : null
      },
      async slugs() {
        return [...TRIPS].sort(byOrder).map((t) => t.slug)
      },
    },

    posts: {
      async list({ limit, exclude } = {}) {
        let out = [...POSTS].sort(byOrder)
        if (exclude) out = out.filter((p) => p.slug !== exclude)
        return (limit ? out.slice(0, limit) : out).map(withAlt.post)
      },
      async bySlug(slug) {
        const post = POSTS.find((p) => p.slug === slug)
        return post ? withAlt.post(post) : null
      },
      async slugs() {
        return [...POSTS].sort(byOrder).map((p) => p.slug)
      },
    },

    destinations: {
      async list() {
        return [...DESTINATIONS].sort(byOrder).map(withAlt.destination)
      },
      async bySlug(slug) {
        const row = DESTINATIONS.find((d) => d.slug === slug)
        return row ? withAlt.destination(row) : null
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
        return [...CULTURE].sort(byOrder).map(withAlt.culture)
      },
      async bySlug(slug) {
        const row = CULTURE.find((c) => c.slug === slug)
        return row ? withAlt.culture(row) : null
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
      return {
        ok: TRIPS.length > 0 && POSTS.length > 0,
        detail: `${TRIPS.length} journeys, ${POSTS.length} journal entries`,
      }
    },
  }
}
