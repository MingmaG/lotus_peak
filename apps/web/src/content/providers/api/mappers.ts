import type {
  ApiActivity,
  ApiPage,
  ApiPageSection,
  ApiPerson,
  ApiCultureArticle,
  ApiDestination,
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
  Destination,
  GalleryImage,
  PageBand,
  Person,
  Post,
  PostBlock,
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
      ...(day.body ? { body: day.body } : {}),
    })),
    included: row.included,
    excluded: row.excluded,
    faq: row.faq,
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

export function toPostSummary(row: ApiPostSummary, index: number): Post {
  return {
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    date: row.date.slice(0, 10),
    region: row.region,
    heroImage: imagePath(row.heroImage),
    heroAlt: row.heroImage?.alt,
    body: [],
    order: index,
  }
}

export function toPost(row: ApiPost): Post {
  return {
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    date: row.date.slice(0, 10),
    region: row.region,
    heroImage: imagePath(row.heroImage),
    heroAlt: row.heroImage?.alt,
    body: row.body.map(toBlock),
    order: 0,
  }
}

function toBlock(block: ApiPost['body'][number]): PostBlock {
  switch (block.kind) {
    case 'text':
      return { kind: 'text', body: block.body }
    case 'heading':
      return { kind: 'heading', text: block.text }
    case 'list':
      /* The domain's list block has no `ordered`. The design renders a `<ul>`
         and nothing else, and adding the flag to the domain type would be a
         field the renderer ignores. */
      return { kind: 'list', items: block.items }
    case 'quote':
      return { kind: 'quote', text: block.text }
    case 'image':
      return {
        kind: 'image',
        src: imagePath(block.image),
        alt: block.image.alt,
        ...(block.ratio ? { ratio: block.ratio } : {}),
      }
    case 'facts':
      return { kind: 'facts', title: block.title, rows: block.rows }
  }
}

/* -------------------------------------------------------------------------- */
/*  The rest of the catalogue                                                  */
/* -------------------------------------------------------------------------- */

export function toDestination(row: ApiDestination, index = 0): Destination {
  return {
    slug: row.slug,
    name: row.name,
    icon: row.icon ?? ICON_FALLBACK,
    blurb: row.blurb,
    detail: row.detail,
    image: imagePath(row.image),
    imageAlt: row.image?.alt,
    tripSlugs: row.tripSlugs,
    order: index,
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
    summary: row.summary,
    detail: row.detail,
    image: imagePath(row.image),
    imageAlt: row.image?.alt,
    order: index,
  }
}

export function toCultureArticle(row: ApiCultureArticle, index = 0): CultureArticle {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    icon: row.icon ?? ICON_FALLBACK,
    image: imagePath(row.image),
    imageAlt: row.image?.alt,
    order: index,
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
    quote: row.quote,
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
        body: section.body,
        anchor: section.anchor,
      }

    case 'points':
      return {
        kind: 'points',
        eyebrow: section.eyebrow,
        title: section.title,
        lead: section.lead,
        points: section.points.map((point) => ({
          title: point.title,
          body: point.body,
          icon: point.icon,
        })),
      }

    case 'facts':
      return { kind: 'facts', title: section.title, rows: section.rows }

    case 'faq':
      return { kind: 'faq', title: section.title, items: section.items }

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
        lead: section.lead,
        tripSlugs: section.tripSlugs,
      }

    case 'cta':
      return {
        kind: 'cta',
        title: section.title,
        lead: section.lead,
        label: section.label,
        href: section.href,
        band: section.band,
      }

    case 'people':
      return {
        kind: 'people',
        title: section.title,
        lead: section.lead,
        personIds: section.personIds,
      }
  }
}

export function toPerson(row: ApiPerson): Person {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photo: row.photo ? imagePath(row.photo) : null,
    photoAlt: row.photo?.alt,
    languages: row.languages,
  }
}
