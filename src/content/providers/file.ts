import 'server-only'

import { ACTIVITIES, CULTURE, DESTINATIONS, GALLERY, REFLECTIONS, SEASONS, SETTINGS } from '../data/site'
import { POSTS } from '../data/posts'
import { TRIPS } from '../data/trips'
import type { ContentRepository, EnquiryInput } from '../repository'

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order

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
        return limit ? out.slice(0, limit) : out
      },
      async bySlug(slug) {
        return TRIPS.find((t) => t.slug === slug) ?? null
      },
      async slugs() {
        return [...TRIPS].sort(byOrder).map((t) => t.slug)
      },
    },

    posts: {
      async list({ limit, exclude } = {}) {
        let out = [...POSTS].sort(byOrder)
        if (exclude) out = out.filter((p) => p.slug !== exclude)
        return limit ? out.slice(0, limit) : out
      },
      async bySlug(slug) {
        return POSTS.find((p) => p.slug === slug) ?? null
      },
      async slugs() {
        return [...POSTS].sort(byOrder).map((p) => p.slug)
      },
    },

    destinations: {
      async list() {
        return [...DESTINATIONS].sort(byOrder)
      },
      async bySlug(slug) {
        return DESTINATIONS.find((d) => d.slug === slug) ?? null
      },
    },

    activities: {
      async list() {
        return [...ACTIVITIES].sort(byOrder)
      },
    },

    gallery: {
      async list({ limit } = {}) {
        const out = [...GALLERY].sort(byOrder)
        return limit ? out.slice(0, limit) : out
      },
    },

    seasons: {
      async list() {
        return [...SEASONS].sort(byOrder)
      },
    },

    culture: {
      async list() {
        return [...CULTURE].sort(byOrder)
      },
      async bySlug(slug) {
        return CULTURE.find((c) => c.slug === slug) ?? null
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
