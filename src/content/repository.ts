import type { CultureArticle, Destination, Reflection, Season, SiteSettings, Trip, TripType } from './types'

export type EnquiryInput = {
  name: string
  email: string
  country?: string
  phone?: string
  tripSlug?: string
  travellers?: string
  adults?: string
  children?: string
  preferredDates?: string
  message?: string
  restDays?: boolean
  source: 'contact' | 'trip-detail' | 'drawer'
}

/**
 * The whole public surface of content in this app.
 *
 * Pages depend on this interface, never on a provider. Swapping the file
 * provider for Prisma, Payload or Sanity is one env var and one adapter file —
 * see docs/specs/05-data-layer.md.
 *
 * Every method is a named use case the site actually has. There is deliberately
 * no query builder: a generic filter DSL would leak database semantics into
 * pages and be impossible to implement faithfully across SQL, document stores
 * and REST CMSs.
 */
export interface ContentRepository {
  readonly name: string

  trips: {
    list(opts?: { type?: TripType; limit?: number }): Promise<Trip[]>
    bySlug(slug: string): Promise<Trip | null>
    slugs(): Promise<string[]>
  }
  destinations: { list(): Promise<Destination[]> }
  seasons: { list(): Promise<Season[]> }
  culture: {
    list(): Promise<CultureArticle[]>
    bySlug(slug: string): Promise<CultureArticle | null>
  }
  reflections: {
    list(opts?: { tripSlug?: string; featured?: boolean; limit?: number }): Promise<Reflection[]>
  }
  settings: { get(): Promise<SiteSettings> }

  enquiries: { create(input: EnquiryInput): Promise<{ id: string }> }

  health(): Promise<{ ok: boolean; detail?: string }>
}
