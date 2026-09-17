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

export type Trip = {
  slug: string
  title: string
  excerpt: string
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
  overview: string[]
  highlights: string[]
  itinerary: ItineraryDayData[]
  included: string[]
  excluded: string[]
  faq: { question: string; answer: string }[]
  gallery: [src: string, ratio?: string, width?: string][]
}

export type Destination = {
  slug: string
  name: string
  icon: SiteIconName
  blurb: string
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
  order: number
}

export type CultureArticle = {
  slug: string
  title: string
  body: string
  icon: SiteIconName
  image: string
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
}
