import type {
  Activity,
  CultureArticle,
  Destination,
  GalleryImage,
  Post,
  Reflection,
  Person,
  Season,
  SitePage,
  SiteSettings,
  Trip,
  TripType,
} from './types'

export interface SitemapEntry {
  path: string
  lastModified: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

export interface Redirect {
  source: string
  target: string
  permanent: boolean
}

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
  posts: {
    list(opts?: { limit?: number; exclude?: string }): Promise<Post[]>
    bySlug(slug: string): Promise<Post | null>
    slugs(): Promise<string[]>
  }
  destinations: {
    list(): Promise<Destination[]>
    bySlug(slug: string): Promise<Destination | null>
  }
  activities: { list(): Promise<Activity[]> }
  gallery: { list(opts?: { limit?: number }): Promise<GalleryImage[]> }
  seasons: { list(): Promise<Season[]> }
  culture: {
    list(): Promise<CultureArticle[]>
    bySlug(slug: string): Promise<CultureArticle | null>
  }
  reflections: {
    list(opts?: { tripSlug?: string; featured?: boolean; limit?: number }): Promise<Reflection[]>
  }
  /**
   * The editorial pages: About, Contact, Terms, Travellers' information, and
   * the words around each index route.
   *
   * `byPath` rather than `bySlug` because a page's identity *is* its URL — the
   * home page's is `/`, which no slug can express without a special case at
   * both ends of the wire.
   */
  pages: {
    byPath(path: string): Promise<SitePage | null>
    list(): Promise<Pick<SitePage, 'path' | 'title' | 'lead'>[]>
  }

  people: { list(): Promise<Person[]> }

  settings: { get(): Promise<SiteSettings> }

  /**
   * What the sitemap, the feed, `llms.txt` and the redirect middleware need.
   *
   * Its own group rather than methods on each entity, because every one of
   * these reads *across* the catalogue — a sitemap is journeys and journal
   * entries and pages together — and because they are the only reads whose
   * caller is a crawler rather than a page.
   *
   * `llmsTxt` and `llmsFullTxt` return finished text. The alternative is this
   * app fetching every journey and every entry over HTTP to reassemble what is
   * four queries away on the other side of the wire.
   */
  discovery: {
    sitemap(): Promise<SitemapEntry[]>
    redirects(): Promise<Redirect[]>
    llmsTxt(): Promise<string>
    llmsFullTxt(): Promise<string>
  }

  enquiries: { create(input: EnquiryInput): Promise<{ id: string }> }

  health(): Promise<{ ok: boolean; detail?: string }>
}
