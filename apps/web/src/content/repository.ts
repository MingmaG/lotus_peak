import type { ApiEnquiryInput } from '@lotuspeak/api-contracts'

import type {
  Activity,
  CultureArticle,
  CulturePage,
  Destination,
  DestinationPage,
  GalleryImage,
  JournalCategory,
  Post,
  PostPage,
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

/**
 * What the website sends when somebody writes to the office.
 *
 * Derived from the wire type rather than written out again. It was written out
 * again once, and `adults` drifted to `string` on this side while the admin
 * panel went on expecting a number — so every enquiry carrying a party size was
 * refused with a validation error the form never showed. Deriving it makes that
 * particular mistake a compile error.
 *
 * `source` is narrowed because the website has three forms and none of them is
 * the newsletter, and the three fields the provider fills in itself are not the
 * caller's to pass.
 */
/**
 * An enquiry the other end declined to take.
 *
 * Carries the status because the two cases read very differently to the person
 * who wrote it: a 4xx is something they can act on — several enquiries in a few
 * minutes, an address with a typo in it — and the endpoint's own words are the
 * right ones to show, since it is a public endpoint and writes for the public.
 * Anything else is ours, and they get a way to reach the office instead.
 */
export class EnquiryRefused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'EnquiryRefused'
  }
}

export type EnquiryInput = Omit<
  ApiEnquiryInput,
  'source' | 'honeypot' | 'pagePath' | 'utm'
> & {
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
    /** `featured` filters on the office's "Feature this journey" switch. */
    list(opts?: { type?: TripType; featured?: boolean; limit?: number }): Promise<Trip[]>
    bySlug(slug: string): Promise<Trip | null>
    slugs(): Promise<string[]>
  }
  posts: {
    list(opts?: { limit?: number; exclude?: string; category?: JournalCategory }): Promise<Post[]>
    bySlug(slug: string): Promise<PostPage | null>
    slugs(): Promise<string[]>
  }
  /**
   * Where we go. `list` is every valley and every place, valleys first;
   * `bySlug` finds either — destination slugs are unique across both, and the
   * page checks the valley in its URL against the record's.
   */
  destinations: {
    list(): Promise<Destination[]>
    bySlug(slug: string): Promise<DestinationPage | null>
  }
  activities: { list(): Promise<Activity[]> }
  gallery: { list(opts?: { limit?: number }): Promise<GalleryImage[]> }
  seasons: { list(): Promise<Season[]> }
  culture: {
    list(): Promise<CultureArticle[]>
    bySlug(slug: string): Promise<CulturePage | null>
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
