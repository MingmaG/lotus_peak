import 'server-only'

import type { PageBand, SitePage } from './types'

/**
 * Reading a page's words out of its bands, for a page that has its own layout.
 *
 * Most editorial pages are drawn by `PageBands`, which renders the ten band
 * types generically. Two are not: About and the index routes have layouts the
 * design made for them — an alternating figure-and-copy rhythm, a
 * `WindowFrame`, a masonry — and rendering those through a generic switch
 * would be redrawing an approved design as a worse one.
 *
 * So those pages keep their layout and take only their *copy* from the row.
 * These helpers are how: they pull the pairs and lists a bespoke layout wants
 * out of the same bands the admin panel edits, so the office writes the words
 * in one place and the page that renders them is still the page that was
 * designed.
 */

/**
 * The `points` band's items — About's commitments, the home page's purposes.
 *
 * `body` is sanitised HTML, like every rich-text field out of the provider, so
 * it is drawn with `Prose`. Put in a `<p>` as text it shows the office its own
 * `<p>` tags, which is how this was found.
 */
export function pointsFrom(page: SitePage | null, index = 0): {
  title: string
  body: string
}[] {
  const bands = (page?.bands ?? []).filter(
    (band): band is Extract<PageBand, { kind: 'points' }> => band.kind === 'points',
  )
  return bands[index]?.points.map((point) => ({ title: point.title, body: point.body })) ?? []
}

/**
 * Figure-and-prose pairs, as About's alternating rhythm needs them.
 *
 * The admin panel stores them as separate bands — a `figure` then a `prose` —
 * because that is what they are, and because storing a compound "figure with
 * copy" band would be a band type nothing else could use. Pairing them back up
 * is this function's whole job.
 */
export function figurePairsFrom(page: SitePage | null): {
  title: string
  body: string
  src: string
  alt: string | undefined
}[] {
  const bands = page?.bands ?? []
  const pairs: { title: string; body: string; src: string; alt: string | undefined }[] = []

  for (let i = 0; i < bands.length - 1; i += 1) {
    const figure = bands[i]
    const prose = bands[i + 1]
    if (figure?.kind !== 'figure' || prose?.kind !== 'prose') continue

    pairs.push({
      title: prose.title ?? '',
      /* Sanitised HTML, drawn with `Prose` — a second paragraph the office
         adds is a paragraph, not two run together. */
      body: prose.body,
      src: figure.src,
      alt: figure.alt,
    })
    i += 1
  }

  return pairs
}

/** The first `prose` band's body, for a layout with one block of copy. */
export function proseFrom(page: SitePage | null): string {
  const band = (page?.bands ?? []).find(
    (one): one is Extract<PageBand, { kind: 'prose' }> => one.kind === 'prose',
  )
  return band ? stripOuterParagraph(band.body) : ''
}

function stripOuterParagraph(html: string): string {
  const match = /^<p>([\s\S]*)<\/p>$/.exec(html.trim())
  if (!match || match[1] === undefined) return html
  /* Only when there is exactly one paragraph — two would concatenate into a
     single run-on sentence. */
  return match[1].includes('<p>') ? html : match[1]
}
