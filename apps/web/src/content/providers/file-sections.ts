import 'server-only'

import { renderStoredRichText } from '@/lib/rich-text'
import { altFor } from '@/lib/assets'
import type { SiteIconName } from '@/design-system'

import { CULTURE, DESTINATIONS } from '../data/site'
import { blocksToHtml } from '../data/post-body'
import { POSTS } from '../data/posts'
import type {
  CultureArticle,
  CulturePage,
  Destination,
  DestinationPage,
  EntitySeo,
  Post,
} from '../types'

/**
 * Where we go and Culture, for the file provider.
 *
 * The source files in `../data` are what lotuspeak.org said: a paragraph per
 * valley and per culture piece, and five journal entries that were really
 * places. This does to them, in code, what the migration
 * `20260923090000_where_we_go_culture_and_journal` does to a database that
 * held them — the same split, the same moves, the same links — so a page
 * rendered from this provider and one rendered from a migrated database say
 * the same thing. That is the property that makes this provider a fixture.
 */

const EMPTY_SEO: EntitySeo = {
  title: null,
  description: null,
  canonical: null,
  noIndex: false,
  noFollow: false,
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  keywords: [],
  updatedAt: null,
}

/** The three place pieces, and the valley each is inside. As in the migration. */
const PLACE_MOVES: { post: string; parent: string; icon: SiteIconName; blurb: string }[] = [
  { post: 'taktsang', parent: 'paro', icon: 'monastery', blurb: 'The temple on the cliff above the Paro valley' },
  {
    post: 'punakha-dzong',
    parent: 'punakha',
    icon: 'dzong-long',
    blurb: 'The Palace of Great Happiness, between two rivers',
  },
  { post: 'trongsa-dzong', parent: 'trongsa', icon: 'dzong', blurb: 'The ancestral seat of the Wangchuck dynasty' },
]

/** The two valley pieces, folded into their valley's body. */
const VALLEY_MERGES = ['thimphu', 'bumthang']

/** First sentence, and the rest. The migration's `lp_first_sentence`. */
function split(paragraph: string): { first: string; rest: string } {
  const plain = paragraph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const match = /^.*?[.!?](?=\s|$)/.exec(plain)
  const first = match ? match[0] : plain
  return { first, rest: plain.slice(first.length).trim() }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const paragraph = (text: string) => (text ? `<p>${escapeHtml(text)}</p>` : '')

interface FileDestination extends Destination {
  body: string
}

function buildDestinations(): FileDestination[] {
  const valleys = [...DESTINATIONS].sort((a, b) => a.order - b.order)

  const out: FileDestination[] = valleys.map((row, index) => {
    const { first, rest } = split(row.detail)
    const merged = VALLEY_MERGES.includes(row.slug) ? POSTS.find((p) => p.slug === row.slug) : undefined
    const body = [paragraph(rest), merged ? blocksToHtml(merged.body, altFor) : '']
      .filter(Boolean)
      .join('\n')

    return {
      slug: row.slug,
      name: row.name,
      path: `/destinations/${row.slug}`,
      parentSlug: null,
      icon: row.icon,
      blurb: row.blurb,
      standfirst: first,
      image: row.image,
      imageAlt: altFor(row.image),
      tripSlugs: row.tripSlugs,
      places: [],
      altitudeMetres: null,
      latitude: null,
      longitude: null,
      order: index,
      body: renderStoredRichText(body),
    }
  })

  for (const move of PLACE_MOVES) {
    const post = POSTS.find((p) => p.slug === move.post)
    const parent = out.find((d) => d.slug === move.parent)
    if (!post || !parent) continue

    const path = `${parent.path}/${post.slug}`
    parent.places.push({ slug: post.slug, title: post.title, path })
    out.push({
      slug: post.slug,
      name: post.title,
      path,
      parentSlug: parent.slug,
      icon: move.icon,
      blurb: move.blurb,
      standfirst: post.standfirst,
      image: post.heroImage,
      imageAlt: altFor(post.heroImage),
      /* A place is offered by the journeys through its valley. */
      tripSlugs: parent.tripSlugs,
      places: [],
      altitudeMetres: null,
      latitude: null,
      longitude: null,
      order: parent.places.length - 1,
      body: renderStoredRichText(blocksToHtml(post.body, altFor)),
    })
  }

  return out
}

interface FileCulture extends CultureArticle {
  body: string
  destinationSlugs: string[]
}

function buildCulture(): FileCulture[] {
  return [...CULTURE]
    .sort((a, b) => a.order - b.order)
    .map((row, index) => {
      const { first, rest } = split(row.body)
      return {
        slug: row.slug,
        title: row.title,
        path: `/culture/${row.slug}`,
        standfirst: first,
        icon: row.icon,
        image: row.image,
        imageAlt: altFor(row.image),
        order: index,
        body: renderStoredRichText(paragraph(rest)),
        destinationSlugs: row.destinations,
      }
    })
}

const strip = <T extends { body: string }>({ body: _body, ...rest }: T) => rest

/** Valleys first, in their order, then places — as the API lists them. */
export function fileDestinationList(): Destination[] {
  return buildDestinations().map((row) => {
    const { body: _body, ...summary } = row
    return summary
  })
}

export function fileCultureList(): CultureArticle[] {
  return buildCulture().map((row) => {
    const { body: _body, destinationSlugs: _links, ...summary } = row
    return summary
  })
}

/**
 * The journal is empty in this provider.
 *
 * All five of its source entries were places, and every one of them moved
 * under Where we go. The journal's shelves are for writing the office has not
 * done yet, and a fixture that invented some would be a fixture that disagreed
 * with the database.
 */
export function filePosts(): Post[] {
  return []
}

export function fileDestinationPage(slug: string): DestinationPage | null {
  const all = buildDestinations()
  const row = all.find((d) => d.slug === slug)
  if (!row) return null

  const parent = row.parentSlug ? all.find((d) => d.slug === row.parentSlug) : undefined
  const placeCards = all.filter((d) => d.parentSlug === row.slug).map(strip)
  const ids = new Set([row.slug, ...placeCards.map((p) => p.slug)])
  const culture = buildCulture()
    .filter((c) => c.destinationSlugs.some((s) => ids.has(s)))
    .map((c) => {
      const { body: _body, destinationSlugs: _links, ...summary } = c
      return summary
    })

  return {
    ...strip(row),
    body: row.body,
    parent: parent ? { slug: parent.slug, title: parent.name, path: parent.path } : null,
    placeCards,
    culture,
    posts: [],
    seo: EMPTY_SEO,
  }
}

export function fileCulturePage(slug: string): CulturePage | null {
  const row = buildCulture().find((c) => c.slug === slug)
  if (!row) return null
  const destinations = buildDestinations()
  const { destinationSlugs, body, ...summary } = row

  return {
    ...summary,
    body,
    destinations: destinationSlugs
      .map((s) => destinations.find((d) => d.slug === s))
      .filter((d): d is FileDestination => d !== undefined)
      .map(strip),
    posts: [],
    seo: EMPTY_SEO,
  }
}
