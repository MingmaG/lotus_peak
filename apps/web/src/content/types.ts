import type { SiteIconName } from '@/design-system'

export type TripType = 'mindfulness' | 'meditation' | 'festival' | 'trekking'
export type Difficulty = 'Gentle' | 'Moderate' | 'Demanding'
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'

export type ItineraryDayData = {
  day?: number
  rest?: boolean
  title: string
  meta?: string
  body?: string
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
  seasonLabel: string
  paceNote: string
  journeyLabel: string
  heroImage: string
  heroAlt?: ImageAlt
  overview: string[]
  highlights: string[]
  itinerary: ItineraryDayData[]
  included: string[]
  excluded: string[]
  faq: { question: string; answer: string }[]
  gallery: [src: string, ratio?: string, width?: string, alt?: string][]
}

export type Destination = {
  slug: string
  name: string
  icon: SiteIconName
  blurb: string
  /** A paragraph for the destinations index. The blurb is the one-line form. */
  detail: string
  image: string
  imageAlt?: ImageAlt
  /** Journeys that go there, in the order they should be offered. */
  tripSlugs: string[]
  order: number
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
 * A journal entry.
 *
 * The body is a list of typed blocks rather than a markdown string. The entries
 * came out of WordPress as markdown, but rendering markdown at runtime would
 * mean a parser, a sanitiser and a set of prose styles that drift from the
 * design system. Blocks are validated by the compiler, render through the same
 * components as the rest of the site, and map cleanly onto a CMS rich-text
 * field when one arrives (docs/specs/04-content-model.md).
 */
export type PostBlock =
  | { kind: 'text'; body: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'image'; src: string; ratio?: string; alt?: string }
  | { kind: 'facts'; title: string; rows: [label: string, value: string][] }

export type Post = {
  slug: string
  title: string
  standfirst: string
  /** See the note on `schemaJson` below. */
  schemaJson?: unknown
  /** ISO date, for `dateTime` and for sorting. `order` is the editorial order. */
  date: string
  region: string
  heroImage: string
  heroAlt?: ImageAlt
  body: PostBlock[]
  order: number
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

export type CultureArticle = {
  slug: string
  title: string
  body: string
  icon: SiteIconName
  image: string
  imageAlt?: ImageAlt
  order: number
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

export type SiteSettings = {
  brand: string
  line: string
  nav: { label: string; href: string }[]
  navCta: { label: string; href: string }
  footer: { columns: { title: string; links: { label: string; href: string }[] }[]; note: string }
  contact: { phone: string; email: string; replyPromise: string }
  pledge: { percent: number; beneficiary: string }
  sdfPerNightUsd: number
  defaultSeo: { title: string; description: string }
}

/* ---------------------------------------------------------------------------
   Formatting lives here so the thin-space / middot conventions are applied in
   one place. The design project stores these pre-formatted, which makes the
   data unsortable — these are derived, never stored.
   --------------------------------------------------------------------------- */

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
  | { kind: 'trips'; title: string | null; lead: string | null; tripSlugs: string[] }
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
