import { renderStoredRichText } from '@/lib/rich-text'
import type {
  ApiActivity,
  ApiPage,
  ApiPageSection,
  ApiPerson,
  ApiCultureArticle,
  ApiCultureSummary,
  ApiDestination,
  ApiDestinationSummary,
  ApiSeo,
  ApiGalleryImage,
  ApiImage,
  ApiPost,
  ApiPostSummary,
  ApiReflection,
  ApiSeason,
  ApiSite,
  ApiTrip,
  ApiTripSummary,
  SiteIconName,
} from '@lotuspeak/api-contracts'

import { registerMedia } from '@/lib/assets'

import type {
  Activity,
  CultureArticle,
  CulturePage,
  Destination,
  DestinationPage,
  EntitySeo,
  GalleryImage,
  PageBand,
  Person,
  Post,
  PostPage,
  SitePage,
  Reflection,
  Season,
  SeasonKey,
  SiteSettings,
  Trip,
} from '../../types'

/**
 * Wire shapes → this site's domain types.
 *
 * The domain types are the design's, and they are deliberately narrower than
 * the wire: a component takes `image: string` because it renders one `<img>`,
 * and giving it the whole `ApiImage` would put the API's vocabulary inside the
 * design system. When they disagree, the domain type wins and the difference
 * is absorbed here.
 *
 * Two differences are worth naming:
 *
 * **`order` is the index.** The domain types carry it because the file
 * provider sorted by it. The API returns rows already in the order the office
 * chose, so re-deriving it from the position is the only way for the two to
 * agree — a stored `order` arriving out of step with the array would let a
 * consumer that re-sorts disagree with the admin panel's own preview.
 *
 * **Images become paths.** The site renders `src` strings. `ApiImage` carries
 * alt text, dimensions and a focal point as well, and all three are used by
 * the design system through `media()` — which now reads from the payload
 * rather than from a module constant. See `imagePath` below.
 */

/**
 * The URL a component renders.
 *
 * Before the move this was `/assets/imagery/taktshang.webp`, a file in
 * `public/`. It is now the media store's URL for the largest WebP rendition,
 * which is the visible change this cutover makes to every page — and the
 * reason it is correct: the photograph is a row the office can replace, crop
 * and re-describe, and the site follows it without an edit.
 */
function imagePath(image: ApiImage | null | undefined): string {
  if (!image) return ''
  /**
   * Registering as a side effect of mapping.
   *
   * Unlovely, and the alternative is worse: every mapper would have to
   * remember a second call beside every `imagePath`, and the one that forgot
   * would ship a page of undescribed images that nothing catches — no type
   * error, no failing build, just a silent accessibility regression on one
   * route. Doing it here means it cannot be forgotten, because a photograph
   * that is not registered is a photograph the page has no URL for either.
   */
  registerMedia(image.url, {
    alt: image.alt,
    width: image.width,
    height: image.height,
  })
  return image.url
}

const ICON_FALLBACK: SiteIconName = 'dzong'

/* -------------------------------------------------------------------------- */
/*  Journeys                                                                   */
/* -------------------------------------------------------------------------- */

export function toTripSummary(row: ApiTripSummary, index: number): Trip {
  /**
   * A summary widened into a `Trip`.
   *
   * The domain has one `Trip` type and the wire has two, because a card needs
   * a twentieth of what a journey page does and sending the itinerary to
   * render five cards is several hundred kilobytes for nothing. The fields a
   * card never reads come back empty here, and the compiler cannot tell the
   * difference — which is the one genuinely uncomfortable thing about this
   * mapper.
   *
   * It is safe because of where the two are used: `trips.list()` feeds
   * `TrekCard` and the filter, and `trips.bySlug()` feeds the journey page.
   * Nothing renders an itinerary from a list. If something ever needs to, the
   * fix is a fuller list endpoint, not a mapper that invents days.
   */
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    type: row.type,
    order: index,
    regions: row.regions,
    durationDays: row.durationDays,
    nights: row.nights,
    highPointMetres: row.highPointMetres,
    difficulty: row.difficulty,
    priceFromUsd: row.priceFromUsd,
    priceCurrency: 'USD',
    priceNote: null,
    pricingTiers: [],
    faqGroups: [],
    routeMap: null,
    videoUrl: null,
    stats: [],
    elevationProfile: [],
    seasonLabel: row.seasonLabel,
    paceNote: '',
    journeyLabel: row.journeyLabel,
    heroImage: imagePath(row.heroImage),
    heroAlt: row.heroImage?.alt,
    overview: [],
    highlights: [],
    itinerary: [],
    included: [],
    excluded: [],
    faq: [],
    gallery: [],
  }
}

export function toTrip(row: ApiTrip): Trip {
  return {
    schemaJson: row.seo?.schemaJson ?? undefined,
    priceCurrency: row.priceCurrency,
    priceNote: row.priceNote ? renderStoredRichText(row.priceNote) : null,
    pricingTiers: row.pricingTiers,
    faqGroups: row.faqGroups.map((group) => ({
      title: group.title,
      blurb: group.blurb ? renderStoredRichText(group.blurb) : null,
      items: group.items.map((item) => ({
        question: item.question,
        answer: renderStoredRichText(item.answer),
      })),
    })),
    routeMap: row.routeMap ? imagePath(row.routeMap) : null,
    routeMapAlt: row.routeMap?.alt,
    videoUrl: row.videoUrl,
    stats: row.stats,
    elevationProfile: row.elevationProfile,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    type: row.type,
    order: 0,
    regions: row.regions,
    durationDays: row.durationDays,
    nights: row.nights,
    highPointMetres: row.highPointMetres,
    difficulty: row.difficulty,
    priceFromUsd: row.priceFromUsd,
    seasonLabel: row.seasonLabel,
    paceNote: row.paceNote,
    journeyLabel: row.journeyLabel,
    heroImage: imagePath(row.heroImage),
    heroAlt: row.heroImage?.alt,
    overview: row.overview,
    highlights: row.highlights,
    itinerary: row.itinerary.map((day) => ({
      /* `day` is null on a rest day, and the domain type spells that as an
         absent key plus `rest: true` — which is what the design's renderer
         switches on. */
      ...(day.day !== null ? { day: day.day } : {}),
      ...(day.rest ? { rest: true } : {}),
      title: day.title,
      ...(day.meta ? { meta: day.meta } : {}),
      ...(day.body ? { body: renderStoredRichText(day.body) } : {}),
    })),
    included: row.included,
    excluded: row.excluded,
    faq: row.faq.map((item) => ({
      question: item.question,
      answer: renderStoredRichText(item.answer),
    })),
    gallery: row.gallery.map((item) => {
      const cell: [string, string?, string?, string?] = [imagePath(item.image)]
      if (item.ratio) cell[1] = item.ratio
      if (item.width) cell[2] = item.width
      cell[3] = item.image.alt
      return cell
    }),
  }
}

/* -------------------------------------------------------------------------- */
/*  Journal                                                                    */
/* -------------------------------------------------------------------------- */

/** A record's SEO tab, narrowed to what a page's metadata reads. */
export function toSeo(seo: ApiSeo): EntitySeo {
  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    canonical: seo.canonicalUrl,
    noIndex: seo.noIndex,
    noFollow: seo.noFollow,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImage: seo.ogImage ? imagePath(seo.ogImage) : null,
    keywords: seo.keywords,
    schemaJson: seo.schemaJson ?? undefined,
    updatedAt: seo.updatedAt,
  }
}

export function toPostSummary(row: ApiPostSummary, index = 0): Post {
  return {
    slug: row.slug,
    title: row.title,
    path: row.path,
    standfirst: row.standfirst,
    date: row.date.slice(0, 10),
    category: row.category,
    places: row.places,
    heroImage: imagePath(row.heroImage),
    heroAlt: row.heroImage?.alt,
    readingMinutes: row.readingMinutes,
    order: index,
  }
}

export function toPost(row: ApiPost): PostPage {
  return {
    slug: row.slug,
    title: row.title,
    path: `/journal/${row.slug}`,
    standfirst: row.standfirst,
    date: row.date.slice(0, 10),
    category: row.category,
    places: row.destinations.map((d) => ({ slug: d.slug, title: d.name, path: d.path })),
    heroImage: imagePath(row.heroImage),
    heroAlt: row.heroImage?.alt,
    readingMinutes: row.readingMinutes,
    order: 0,
    body: renderStoredRichText(row.body),
    author: row.author ? { name: row.author.name, role: row.author.role } : null,
    tags: row.tags,
    relatedTripSlugs: row.relatedTripSlugs,
    destinations: row.destinations.map((d, i) => toDestination(d, i)),
    culture: row.culture.map((c, i) => toCultureArticle(c, i)),
    seo: toSeo(row.seo),
  }
}

/* -------------------------------------------------------------------------- */
/*  The rest of the catalogue                                                  */
/* -------------------------------------------------------------------------- */

export function toDestination(row: ApiDestinationSummary, index = 0): Destination {
  return {
    slug: row.slug,
    name: row.name,
    path: row.path,
    parentSlug: row.parentSlug,
    icon: row.icon ?? ICON_FALLBACK,
    blurb: row.blurb,
    standfirst: row.standfirst,
    image: imagePath(row.image),
    imageAlt: row.image?.alt,
    tripSlugs: row.tripSlugs,
    places: row.places,
    altitudeMetres: row.altitudeMetres,
    latitude: row.latitude,
    longitude: row.longitude,
    order: index,
  }
}

export function toDestinationPage(row: ApiDestination): DestinationPage {
  return {
    ...toDestination(row),
    body: renderStoredRichText(row.body),
    parent: row.parent,
    placeCards: row.placeCards.map((place, i) => toDestination(place, i)),
    culture: row.culture.map((c, i) => toCultureArticle(c, i)),
    posts: row.posts.map((p, i) => toPostSummary(p, i)),
    seo: toSeo(row.seo),
  }
}

export function toActivity(row: ApiActivity, index = 0): Activity {
  return {
    slug: row.slug,
    name: row.name,
    blurb: row.blurb,
    icon: row.icon ?? ICON_FALLBACK,
    image: imagePath(row.image),
    imageAlt: row.image?.alt,
    examples: row.examples,
    tripSlugs: row.tripSlugs,
    order: index,
  }
}

export function toSeason(row: ApiSeason, index = 0): Season {
  return {
    key: row.key as SeasonKey,
    monthsLabel: row.monthsLabel,
    name: row.name,
    headline: row.headline,
    summary: renderStoredRichText(row.summary),
    detail: renderStoredRichText(row.detail),
    image: imagePath(row.image),
    imageAlt: row.image?.alt,
    order: index,
  }
}

/**
 * Rich text is sanitised here, once, at the boundary.
 *
 * Not in the components that draw it. `Itinerary`, `Reflection` and the rest
 * of the design system are client components, and `renderStoredRichText` is
 * `server-only` — but the real reason is that a body should be safe because
 * of where it came from, not because of what happened to draw it. A component
 * that receives a body and forgets to sanitise it is a bug you find in
 * production; a mapper that forgets is a bug you find in this file.
 *
 * `renderStoredRichText` rather than `renderRichText`, because these columns
 * predate their editor. Half of them hold `<p>…</p><ul>…` written in the
 * rich-text editor and half hold a paragraph somebody typed into a box before
 * there was one. Both are what the office wrote, and both have to draw as
 * prose.
 */
export function toCultureArticle(row: ApiCultureSummary, index = 0): CultureArticle {
  return {
    slug: row.slug,
    title: row.title,
    path: row.path,
    standfirst: row.standfirst,
    icon: row.icon ?? ICON_FALLBACK,
    image: imagePath(row.image),
    imageAlt: row.image?.alt,
    order: index,
  }
}

export function toCulturePage(row: ApiCultureArticle): CulturePage {
  return {
    ...toCultureArticle(row),
    body: renderStoredRichText(row.body),
    destinations: row.destinations.map((d, i) => toDestination(d, i)),
    posts: row.posts.map((p, i) => toPostSummary(p, i)),
    seo: toSeo(row.seo),
  }
}

export function toGalleryImage(row: ApiGalleryImage, index = 0): GalleryImage {
  return {
    src: imagePath(row.image),
    alt: row.image.alt,
    caption: row.caption,
    ratio: row.ratio,
    order: index,
  }
}

export function toReflection(row: ApiReflection, index = 0): Reflection {
  return {
    id: row.id,
    quote: renderStoredRichText(row.quote),
    name: row.name,
    ...(row.detail ? { detail: row.detail } : {}),
    ...(row.tripSlug ? { tripSlug: row.tripSlug } : {}),
    featured: row.featured,
    order: index,
  }
}

/* -------------------------------------------------------------------------- */
/*  Settings                                                                   */
/* -------------------------------------------------------------------------- */

export function toSettings(site: ApiSite): SiteSettings {
  const phone = site.company.contacts.find(
    (contact) => contact.kind === 'PHONE' || contact.kind === 'MOBILE',
  )
  const email = site.company.contacts.find((contact) => contact.kind === 'EMAIL')

  return {
    brand: site.company.name,
    line: site.company.tagline,
    nav: site.nav.map((link) => ({ label: link.label, href: link.href })),
    navCta: site.navCta ?? { label: 'Explore trips', href: '/trips' },
    footer: {
      columns: site.footer.columns.map((column) => ({
        title: column.title,
        links: column.links.map((link) => ({ label: link.label, href: link.href })),
      })),
      /**
       * The footer note, with the company's own contact line appended.
       *
       * The design's note reads "Lotus Peak Tours & Travel · Thimphu, Bhutan ·
       * +975 17984485" — three facts, two of which are the company record. The
       * stored note holds the first two and the telephone number is joined on
       * here, so changing the number in one screen changes it in the footer
       * too. Typing it into the note as well is exactly what the Company
       * screen exists to stop.
       */
      note: [site.footer.note, phone?.display].filter(Boolean).join(' · '),
    },
    contact: {
      phone: phone?.display ?? '',
      email: email?.value ?? '',
      replyPromise: site.replyPromise,
    },
    pledge: {
      percent: site.pledge?.percent ?? 0,
      beneficiary: site.pledge?.beneficiary ?? '',
    },
    sdfPerNightUsd: site.sdfPerNightUsd,
    defaultSeo: {
      title: site.defaultSeo.defaultTitle,
      description: site.defaultSeo.description,
    },
  }
}


/* -------------------------------------------------------------------------- */
/*  Pages                                                                      */
/* -------------------------------------------------------------------------- */

export function toPage(row: ApiPage): SitePage {
  return {
    slug: row.slug,
    path: row.path,
    title: row.title,
    eyebrow: row.eyebrow,
    lead: row.lead,
    heroImage: row.heroImage ? imagePath(row.heroImage) : null,
    heroAlt: row.heroImage?.alt,
    bands: row.sections.map(toBand).filter((band): band is PageBand => band !== null),
    seo: {
      title: row.seo.metaTitle,
      description: row.seo.metaDescription,
      noIndex: row.seo.noIndex,
      schemaJson: row.seo.schemaJson ?? undefined,
    },
  }
}

/**
 * One band.
 *
 * A `figure` whose photograph has been deleted is dropped rather than rendered
 * as a gap — the same rule the journal body follows, and for the same reason:
 * a nullable image inside a band is a null every renderer downstream has to
 * handle, introduced by a deletion that happened once.
 */
function toBand(section: ApiPageSection): PageBand | null {
  switch (section.kind) {
    case 'prose':
      return {
        kind: 'prose',
        eyebrow: section.eyebrow,
        title: section.title,
        body: renderStoredRichText(section.body),
        anchor: section.anchor,
      }

    case 'points':
      return {
        kind: 'points',
        eyebrow: section.eyebrow,
        title: section.title,
        lead: renderStoredRichText(section.lead),
        points: section.points.map((point) => ({
          title: point.title,
          body: renderStoredRichText(point.body),
          icon: point.icon,
        })),
      }

    case 'facts':
      return { kind: 'facts', title: section.title, rows: section.rows }

    case 'faq':
      return {
        kind: 'faq',
        title: section.title,
        items: section.items.map((item) => ({
          question: item.question,
          answer: renderStoredRichText(item.answer),
        })),
      }

    case 'figure':
      return {
        kind: 'figure',
        src: imagePath(section.image),
        alt: section.image.alt,
        caption: section.caption,
        width: section.width,
      }

    case 'gallery':
      return {
        kind: 'gallery',
        title: section.title,
        items: section.items.map((item) => {
          const cell: [string, string?, string?, string?] = [imagePath(item.image)]
          if (item.ratio) cell[1] = item.ratio
          if (item.width) cell[2] = item.width
          cell[3] = item.image.alt
          return cell
        }),
      }

    case 'reflections':
      return { kind: 'reflections', title: section.title, reflectionIds: section.reflectionIds }

    case 'trips':
      return {
        kind: 'trips',
        title: section.title,
        lead: renderStoredRichText(section.lead),
        tripSlugs: section.tripSlugs,
      }

    case 'cta':
      return {
        kind: 'cta',
        title: section.title,
        lead: renderStoredRichText(section.lead),
        label: section.label,
        href: section.href,
        band: section.band,
      }

    case 'people':
      return {
        kind: 'people',
        title: section.title,
        lead: renderStoredRichText(section.lead),
        personIds: section.personIds,
      }
  }
}

export function toPerson(row: ApiPerson): Person {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: renderStoredRichText(row.bio),
    photo: row.photo ? imagePath(row.photo) : null,
    photoAlt: row.photo?.alt,
    languages: row.languages,
  }
}
