import type { JournalCategory } from '@lotuspeak/api-contracts'

import type { SiteIconName, SocialPlatform } from '@/design-system'

export type { JournalCategory, SocialPlatform }

export type TripType = 'mindfulness' | 'meditation' | 'festival' | 'trekking'
export type Difficulty = 'Gentle' | 'Moderate' | 'Demanding'
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'

export type ItineraryDayData = {
  day?: number
  rest?: boolean
  title: string
  meta?: string
  /** Rich text, already sanitised. Drawn by `Prose`, never as text. */
  body?: string
  /**
   * The day's own photographs, as a strip under its prose.
   *
   * Separate from a photograph the office put *inside* `body`: that one
   * belongs to a sentence and arrives as a `<figure>` in the HTML. These
   * belong to the day.
   */
  images?: TripPhoto[]
}

/**
 * A photograph's description, carried beside its `src`.
 *
 * Every record below that holds an image holds one of these. It looks like
 * duplication of the media library and is not: the description has to reach a
 * **client** component — `TrekCard`, `Strip`, `Parallax` and the two heroes are
 * all `'use client'` — and a module-level lookup there reads the client
 * bundle's own copy of `src/lib/assets.ts`, which the server's fetch never
 * touched. Alt text that only exists on the server is alt text that ships as
 * `alt=""`.
 *
 * Optional because the file provider fills it from the static records and a
 * record with no description is a real state, not a missing field.
 */
export type ImageAlt = string | undefined

export type Trip = {
  slug: string
  title: string
  excerpt: string
  /** See the note on `schemaJson` below. */
  schemaJson?: unknown
  type: TripType
  order: number
  /** Ordered destination names: "Paro · Bumthang · Trongsa". */
  regions: string[]
  durationDays: number
  nights: number
  highPointMetres: number
  difficulty: Difficulty
  priceFromUsd: number
  /** ISO 4217, for the price and for the JSON-LD offer. */
  priceCurrency: string
  /** Rich text. What the price includes, under the figure. */
  priceNote: string | null
  /** Empty where one price covers every party size. */
  pricingTiers: PricingTier[]
  seasonLabel: string
  paceNote: string
  journeyLabel: string
  heroImage: string
  heroAlt?: ImageAlt
  /**
   * The large photograph beside the overview, and the small one inset into its
   * corner.
   *
   * The large one falls back to the hero in the mapper, so it is always a
   * path. The inset is null where the office chose none, and the page then
   * draws the single photograph — the corner used to hold one stock picture of
   * somebody walking, on every journey.
   */
  overviewImage: string
  overviewImageAlt?: ImageAlt
  overviewInset: string | null
  overviewInsetAlt?: ImageAlt
  /** The opening, as sanitised rich text. Drawn by `Prose`. */
  overview: string
  highlights: string[]
  itinerary: ItineraryDayData[]
  included: string[]
  excluded: string[]
  /** The questions with no heading. They render first, above the groups. */
  faq: { question: string; answer: string }[]
  faqGroups: FaqGroup[]
  gallery: TripPhoto[]
  /** The route drawn on a map. Empty where the office has not made one. */
  routeMap: string | null
  routeMapAlt?: ImageAlt
  /**
   * The band above the itinerary — "On the trail".
   *
   * Null where the office switched it off, chose no photograph or wrote
   * nothing, and the page then draws no band. The three rules are the
   * provider's, not the page's: a page that had to decide for itself whether
   * a band is empty is a page that will one day disagree with the panel about
   * it.
   */
  trail: TripTrail | null
  /** A film. Rendered as a façade — see `VideoEmbed`. */
  videoUrl: string | null
  /** Beyond the fixed five under the title. Usually empty. */
  stats: { label: string; value: string; note: string | null }[]
  /** The walking profile. Empty for everything but the trekking journeys. */
  elevationProfile: { day: number; label: string; metres: number }[]
  /** Which of the optional bands below the itinerary the office has switched on. */
  sections: TripSections
  /** The places on the route that have pages, in route order. */
  destinations: Destination[]
  /** The culture seen on the way — chosen, or else linked to the route. */
  culture: CultureArticle[]
  /** Journal entries — linked, or else about the route. */
  posts: Post[]
  /**
   * Other journeys to offer, as cards.
   *
   * Summaries widened into `Trip`s, like every list — see `toTripSummary`.
   * Nothing renders more of them than a `TrekCard` does.
   */
  related: Trip[]
}

/**
 * The band above the itinerary: a photograph, and the words over it.
 *
 * The photograph is always there — a band without one is no band, which the
 * provider spells as a null `trail` — and each piece of copy is optional,
 * because the design draws whichever of the three it is given.
 */
export type TripTrail = {
  eyebrow: string | null
  title: string | null
  body: string | null
  image: string
  /** Carried on the record, because the band is a client component. See `ImageAlt`. */
  imageAlt?: ImageAlt
}

/** The journey page's optional bands. Each draws only when it has something in it. */
export type TripSections = {
  gallery: boolean
  destinations: boolean
  culture: boolean
  journal: boolean
  related: boolean
}

/**
 * A photograph in a journey's gallery.
 *
 * An object rather than the strip's old `[src, ratio, width, alt]` tuple,
 * because the viewer needs what the tuple had no room for: the caption and
 * credit it prints under the picture, and the intrinsic size it letterboxes
 * to. The mosaic crops, so the ratio and width hints the strip read are gone.
 */
export type TripPhoto = {
  src: string
  alt?: ImageAlt
  /** Editorial, printed under the photograph in the viewer. Distinct from `alt`. */
  caption: string | null
  credit: string | null
  /** Intrinsic pixels, where known. The viewer letterboxes to them. */
  width: number | null
  height: number | null
  /** Where to hold the crop in the mosaic, as `object-position`. */
  focal: [x: number, y: number]
}

/** What a journey costs at a party size. `maxPeople` null is "and above". */
export type PricingTier = {
  label: string
  minPeople: number
  maxPeople: number | null
  priceUsd: number
  wasPriceUsd: number | null
  note: string | null
}

/** A heading over some of a journey's questions. */
export type FaqGroup = {
  title: string
  /** Rich text. */
  blurb: string | null
  items: { question: string; answer: string }[]
}

/* ---------------------------------------------------------------------------
   Where we go, Culture, Journal

   Three sections that do not overlap. A valley or a place inside one is a
   destination; what makes Bhutan Bhutan is culture; a dated story is the
   journal's. Each has a page, and each links to the other two rather than
   describing them again. `path` travels on every record because a place's
   address is made of two slugs and the panel is the one that spells it.
   --------------------------------------------------------------------------- */

/** Enough to link to a page. */
export type PageRef = { slug: string; title: string; path: string }

/**
 * A record's SEO tab, as a page's metadata needs it.
 *
 * Every field is the office's override or null; `entityMetadata` in
 * `src/lib/seo.ts` resolves each against the record's own title, standfirst
 * and photograph.
 */
export type EntitySeo = {
  title: string | null
  description: string | null
  canonical: string | null
  noIndex: boolean
  noFollow: boolean
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  keywords: string[]
  /** Hand-written JSON-LD from the SEO tab. See the note on `SitePage.seo`. */
  schemaJson?: unknown
  updatedAt: string | null
}

/** A valley, or — with `parentSlug` — a place inside one, as a card draws it. */
export type Destination = {
  slug: string
  name: string
  path: string
  parentSlug: string | null
  icon: SiteIconName
  /** One line. "Taktsang, Kichu and Dungtse Lhakhang". */
  blurb: string
  /** The sentence under the title. */
  standfirst: string
  image: string
  imageAlt?: ImageAlt
  /** Journeys that go there, in the order they should be offered. A place's are its valley's. */
  tripSlugs: string[]
  /** A valley's places. Empty on a place. */
  places: PageRef[]
  altitudeMetres: number | null
  latitude: number | null
  longitude: number | null
  order: number
}

/** A destination's own page. */
export type DestinationPage = Destination & {
  /** Sanitised HTML. */
  body: string
  parent: PageRef | null
  placeCards: Destination[]
  culture: CultureArticle[]
  posts: Post[]
  seo: EntitySeo
}

export type Activity = {
  slug: string
  name: string
  blurb: string
  icon: SiteIconName
  image: string
  imageAlt?: ImageAlt
  /** What the day actually consists of — three to five items. */
  examples: string[]
  tripSlugs: string[]
  order: number
}

/**
 * A journal entry, as a card draws it.
 *
 * `category` is which of the four shelves it sits on; `places` is what it is
 * about, as links. The old `region` string was both at once, and it was how
 * the journal came to be a list of places.
 */
export type Post = {
  slug: string
  title: string
  path: string
  standfirst: string
  /** ISO date, for `dateTime` and for sorting. `order` is the editorial order. */
  date: string
  category: JournalCategory
  places: PageRef[]
  heroImage: string
  heroAlt?: ImageAlt
  readingMinutes: number
  order: number
}

/** A journal entry's own page. */
export type PostPage = Post & {
  /**
   * The entry, as sanitised HTML — already through `renderStoredRichText`,
   * which is what makes it safe for `Prose` to set as inner HTML. See
   * `src/lib/rich-text.ts`.
   */
  body: string
  author: { name: string; role: string | null } | null
  tags: string[]
  relatedTripSlugs: string[]
  destinations: Destination[]
  culture: CultureArticle[]
  seo: EntitySeo
}

export type GalleryImage = {
  src: string
  alt?: ImageAlt
  caption: string
  /** CSS aspect ratio for the masonry cell, e.g. '3/4'. */
  ratio: string
  order: number
}

export type Season = {
  key: SeasonKey
  monthsLabel: string
  name: string
  headline: string
  summary: string
  detail: string
  image: string
  imageAlt?: ImageAlt
  order: number
}

/** A culture piece, as a card draws it. */
export type CultureArticle = {
  slug: string
  title: string
  path: string
  standfirst: string
  icon: SiteIconName
  image: string
  imageAlt?: ImageAlt
  order: number
}

/** A culture piece's own page. */
export type CulturePage = CultureArticle & {
  /** Sanitised HTML. */
  body: string
  /** Where to see it. */
  destinations: Destination[]
  posts: Post[]
  seo: EntitySeo
}

export type Reflection = {
  id: string
  quote: string
  name: string
  detail?: string
  tripSlug?: string
  featured: boolean
  order: number
}

/** One public way to reach the office, with the link it opens already built. */
export type ContactLine = {
  kind: 'phone' | 'whatsapp' | 'email' | 'fax'
  label: string
  display: string
  /** `tel:`, `mailto:` or `wa.me`. Null for a fax, which is read, not followed. */
  href: string | null
}

export type WhatsApp = {
  /** What the office called it in the panel. "WhatsApp". */
  label: string
  /** Digits only, `97517984485` — the `wa.me` path segment. */
  number: string
  /** `+975 17984485`, for a person to read. */
  display: string
  /** What the message opens with, as the office wrote it. */
  prefill: string | null
}

/** A band at the foot of a journey page: its heading and the words on its link. */
export type JourneyBandCopy = { title: string; more: string }

export type SiteSettings = {
  brand: string
  /** The registered name. "Lotus Peak Tours & Travel". */
  legalName: string
  line: string
  /** The words over the home page's photograph; the tagline when the office left it empty. */
  strapline: string
  /**
   * What the office chose to play behind those words.
   *
   * The choice and the address, not the picture: the hero's photograph is a
   * brand asset in `lib/assets`, as it has been since the design was approved,
   * and `lib/hero-media.ts` is what puts the two together.
   */
  hero: { media: 'image' | 'youtube'; youtubeUrl: string | null }
  nav: { label: string; href: string }[]
  navCta: { label: string; href: string }
  footer: {
    columns: { title: string; links: { label: string; href: string }[] }[]
    /** The introduction under the name; the tagline when the office left it empty. */
    note: string
    /** The copyright line, `{year}` and `{name}` already substituted. */
    copyright: string
    credit: { label: string; name: string; url: string | null } | null
    show: { links: boolean; address: boolean; contacts: boolean; socials: boolean }
  }
  /** The office's address, one printed line per entry. */
  address: { lines: string[]; mapUrl: string | null }
  contacts: ContactLine[]
  /**
   * The office's WhatsApp, apart from `contacts`, because a link to it is not
   * one fixed string: on a journey page the message names the journey. Null
   * when the office has entered no WhatsApp number, and then nothing on the
   * site offers it — the floating button included.
   */
  whatsapp: WhatsApp | null
  socials: { platform: SocialPlatform; label: string; url: string }[]
  journeyBands: Record<'places' | 'culture' | 'journal' | 'related', JourneyBandCopy>
  contact: { phone: string; email: string; replyPromise: string }
  /**
   * Cloudflare Turnstile's public site key, from the panel that holds its
   * secret. Null means the panel asks for no check, and the forms draw none.
   */
  captchaSiteKey: string | null
  pledge: { percent: number; beneficiary: string }
  sdfPerNightUsd: number
  defaultSeo: { title: string; description: string }
  /** Live and upcoming, in the office's order. See `lib/notices.ts` for when each shows. */
  announcements: Announcement[]
  banners: Banner[]
}

/* ---------------------------------------------------------------------------
   Announcements and banners
   --------------------------------------------------------------------------- */

/**
 * When a notice runs and where — compared against the visitor's clock and
 * path in the browser, because the page it is on was prerendered and may be
 * older than the offer it should be showing.
 */
export type NoticeSchedule = {
  startsAt: string | null
  endsAt: string | null
  /** Paths, `/trips/*` for everything below. Empty is every page. */
  showOn: string[]
  hideOn: string[]
}

export type NoticeTone = 'general' | 'offer' | 'advisory' | 'festival'

export type Announcement = NoticeSchedule & {
  id: string
  /** Changes with every edit, so a closed announcement reopens once it says something new. */
  version: string
  tone: NoticeTone
  label: string | null
  /** Sanitised HTML — already through `renderNoticeText`. */
  message: string
  href: string | null
  linkLabel: string | null
  dismissible: boolean
}

export type BannerImage = {
  src: string
  alt: ImageAlt
  width: number | null
  height: number | null
  focal: [x: number, y: number]
}

export type Banner = NoticeSchedule & {
  id: string
  version: string
  placement: 'page-end' | 'popup'
  layout: 'image-left' | 'image-right' | 'backdrop'
  theme: 'paper' | 'mist' | 'ink'
  eyebrow: string | null
  heading: string
  /** Sanitised HTML — already through `renderRichText`. */
  body: string
  image: BannerImage | null
  href: string | null
  linkLabel: string | null
  secondaryHref: string | null
  secondaryLabel: string | null
}

/* ---------------------------------------------------------------------------
   Formatting lives here so the thin-space / middot conventions are applied in
   one place. The design project stores these pre-formatted, which makes the
   data unsortable — these are derived, never stored.
   --------------------------------------------------------------------------- */

/**
 * The copyright line with its tokens filled. `{year}` is resolved when the page
 * is rendered, and the publish-or-hourly rebuild is what carries it into
 * January — not a client-side clock, which would disagree with the server's
 * HTML for the few hours either side of midnight on New Year's Eve.
 */
export function fillCopyright(template: string, name: string, year = new Date().getFullYear()) {
  return template.replaceAll('{year}', String(year)).replaceAll('{name}', name)
}

export const fmt = {
  duration: (t: Trip) => `${t.durationDays} days`,
  nights: (t: Trip) => `${t.nights} nights`,
  altitude: (t: Trip) => `${t.highPointMetres.toLocaleString('en-GB')} m`,
  price: (t: Trip) => `US$ ${t.priceFromUsd.toLocaleString('en-GB')}`,
  regions: (t: Trip) => t.regions.join(' · '),
  regionsShort: (t: Trip) => t.regions.slice(0, 2).join(' · '),
  length: (t: Trip) => `${t.durationDays} days · ${t.nights} nights`,
  /**
   * "14 July 2025". Written out rather than delegated to `toLocaleDateString`,
   * whose output depends on the ICU data of whichever runtime renders it —
   * a server/client mismatch React would flag as a hydration error.
   */
  date: (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-')
    return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
  },
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/* ---------------------------------------------------------------------------
   Editorial pages
   --------------------------------------------------------------------------- */

/**
 * One band of an editorial page.
 *
 * A closed union, matching the admin panel's vocabulary exactly. The renderer
 * switches on `kind` and the compiler checks the switch is total — which is
 * what makes adding a band type a change the compiler insists on finishing.
 *
 * Three of them reference other content rather than carrying their own, and
 * all three treat an empty list as "whatever is published, in its own order".
 * That is what the pages did before they moved into the database, and it is
 * what most of them want.
 */
export type PageBand =
  | {
      kind: 'prose'
      eyebrow: string | null
      title: string | null
      body: string
      /** The fragment this band answers to. Null derives one from the title. */
      anchor: string | null
    }
  | {
      kind: 'points'
      eyebrow: string | null
      title: string | null
      lead: string | null
      points: { title: string; body: string; icon: SiteIconName | null }[]
    }
  | { kind: 'facts'; title: string | null; rows: [label: string, value: string][] }
  | { kind: 'faq'; title: string | null; items: { question: string; answer: string }[] }
  | {
      kind: 'figure'
      src: string
      alt: ImageAlt
      caption: string | null
      width: 'full' | 'inset'
    }
  | {
      kind: 'gallery'
      title: string | null
      items: [src: string, ratio?: string, width?: string, alt?: string][]
    }
  | { kind: 'reflections'; title: string | null; reflectionIds: string[] }
  | {
      kind: 'trips'
      eyebrow: string | null
      title: string | null
      lead: string | null
      tripSlugs: string[]
    }
  | {
      kind: 'cta'
      title: string
      lead: string | null
      label: string
      href: string
      band: boolean
    }
  | { kind: 'people'; title: string | null; lead: string | null; personIds: string[] }

export type SitePage = {
  slug: string
  path: string
  title: string
  eyebrow: string | null
  lead: string | null
  /** A quiet closing line on a reference page. */
  note: string | null
  heroImage: string | null
  heroAlt: ImageAlt
  bands: PageBand[]
/**
 * Hand-written JSON-LD from the record's SEO tab, if there is any.
 *
 * `unknown` rather than a shape: it is whatever the office pasted, and the
 * only thing this side asserts about it is that `pageGraph` will refuse
 * anything that is not an object before it reaches a `<script>`.
 */
  seo: {
    title: string | null
    description: string | null
    noIndex: boolean
    schemaJson?: unknown
  }
}

export type Person = {
  id: string
  name: string
  role: string
  bio: string
  photo: string | null
  photoAlt: ImageAlt
  languages: string[]
}
