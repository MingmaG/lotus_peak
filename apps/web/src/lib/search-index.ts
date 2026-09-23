import 'server-only'
import { journalCategoryLabel } from '@lotuspeak/api-contracts'
import { getContent } from '@/content'
import type { PageBand } from '@/content/types'
import { toPlainText } from '@/lib/rich-text'
import { toFilterLabel } from '@/sections/trips/filters'
import type { SearchDoc } from './search'

/**
 * Enough body to find a page by what it says, not so much that the index
 * becomes the heaviest thing the search page downloads. A long journal entry
 * is found by its first few thousand characters just as surely as by all of
 * them.
 */
const BODY_CHARS = 3000

/**
 * Pages that have their own section of the index or that nobody searches for.
 * The home page is every section at once, and `/search` would find itself.
 */
const SKIP_PAGES = new Set(['/', '/search'])

/**
 * Every document the search page can find, read through the repository like
 * any page — so publishing reaches search by the same tags it reaches the
 * page, and the file provider builds the same index as the API.
 *
 * Bodies come from `bySlug`, which a prerendered page has already fetched in
 * the same build; the fetch cache answers most of these without a request.
 */
export async function buildSearchIndex(): Promise<SearchDoc[]> {
  const content = getContent()
  const [trips, destinations, culture, posts, activities, pages] = await Promise.all([
    content.trips.list(),
    content.destinations.list(),
    content.culture.list(),
    content.posts.list(),
    content.activities.list(),
    content.pages.list(),
  ])

  const valleyName = new Map(destinations.map((d) => [d.slug, d.name]))
  const tripTitle = new Map(trips.map((t) => [t.slug, t.title]))

  const [destinationPages, culturePages, postPages, sitePages] = await Promise.all([
    Promise.all(destinations.map((d) => content.destinations.bySlug(d.slug))),
    Promise.all(culture.map((c) => content.culture.bySlug(c.slug))),
    Promise.all(posts.map((p) => content.posts.bySlug(p.slug))),
    Promise.all(pages.filter((p) => !SKIP_PAGES.has(p.path)).map((p) => content.pages.byPath(p.path))),
  ])

  const docs: SearchDoc[] = []

  for (const trip of trips) {
    const type = toFilterLabel(capitalise(trip.type))
    docs.push({
      kind: 'journey',
      title: trip.title,
      path: `/trips/${trip.slug}`,
      summary: trip.excerpt,
      meta: `${trip.durationDays} days · ${type === 'All' ? trip.journeyLabel : type} · ${trip.difficulty}`,
      image: trip.heroImage || null,
      keywords: [trip.type, trip.journeyLabel, trip.seasonLabel, trip.difficulty, ...trip.regions].join(' '),
      body: clip(
        [
          ...trip.overview,
          ...trip.highlights,
          ...trip.itinerary.flatMap((day) => [day.title, day.meta ?? '', toPlainText(day.body)]),
        ].join(' '),
      ),
    })
  }

  destinations.forEach((d, i) => {
    const page = destinationPages[i]
    const parent = d.parentSlug ? valleyName.get(d.parentSlug) : null
    docs.push({
      kind: 'place',
      title: d.name,
      path: d.path,
      summary: d.standfirst || d.blurb,
      meta: parent ? `In ${parent}` : 'Valley',
      image: d.image || null,
      keywords: [
        parent ?? '',
        ...d.places.map((p) => p.title),
        ...d.tripSlugs.map((s) => tripTitle.get(s) ?? ''),
      ].join(' '),
      body: clip([d.blurb, toPlainText(page?.body)].join(' ')),
    })
  })

  culture.forEach((c, i) => {
    docs.push({
      kind: 'culture',
      title: c.title,
      path: c.path,
      summary: c.standfirst,
      meta: 'Culture',
      image: c.image || null,
      keywords: (culturePages[i]?.destinations ?? []).map((d) => d.name).join(' '),
      body: clip(toPlainText(culturePages[i]?.body)),
    })
  })

  posts.forEach((p, i) => {
    const page = postPages[i]
    docs.push({
      kind: 'journal',
      title: p.title,
      path: p.path,
      summary: p.standfirst,
      meta: `${journalCategoryLabel(p.category)} · ${formatDate(p.date)}`,
      image: p.heroImage || null,
      keywords: [
        journalCategoryLabel(p.category),
        ...(page?.tags ?? []),
        ...p.places.map((place) => place.title),
        page?.author?.name ?? '',
      ].join(' '),
      body: clip(toPlainText(page?.body)),
    })
  })

  for (const a of activities) {
    docs.push({
      kind: 'activity',
      title: a.name,
      // The activities page anchors each one by its slug.
      path: `/activities#${a.slug}`,
      summary: a.blurb,
      meta: 'Activity',
      image: a.image || null,
      keywords: a.tripSlugs.map((s) => tripTitle.get(s) ?? '').join(' '),
      body: clip(a.examples.join(' ')),
    })
  }

  for (const page of sitePages) {
    // A page the office has asked search engines to leave alone is not one to
    // offer here either.
    if (!page || page.seo.noIndex) continue
    docs.push({
      kind: 'page',
      title: page.title,
      path: page.path,
      summary: page.lead ?? page.seo.description ?? '',
      meta: page.eyebrow ?? 'Page',
      image: page.heroImage,
      keywords: page.eyebrow ?? '',
      body: clip(page.bands.map(bandText).join(' ')),
    })
  }

  return docs
}

/** The words in a band. Photographs and reflections carry none of the page's own. */
function bandText(band: PageBand): string {
  switch (band.kind) {
    case 'prose':
      return [band.eyebrow, band.title, toPlainText(band.body)].filter(Boolean).join(' ')
    case 'points':
      return [band.eyebrow, band.title, toPlainText(band.lead), ...band.points.flatMap((p) => [p.title, toPlainText(p.body)])]
        .filter(Boolean)
        .join(' ')
    case 'facts':
      return [band.title, ...band.rows.flat()].filter(Boolean).join(' ')
    case 'faq':
      return [band.title, ...band.items.flatMap((q) => [q.question, toPlainText(q.answer)])].filter(Boolean).join(' ')
    case 'trips':
    case 'people':
    case 'cta':
      return [band.title, toPlainText(band.lead)].filter(Boolean).join(' ')
    default:
      return ''
  }
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > BODY_CHARS ? flat.slice(0, BODY_CHARS) : flat
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
