/**
 * Site search: the shape of the index and the ranking over it.
 *
 * Plain module, no 'use client' — the index route builds `SearchDoc`s on the
 * server and the search page ranks them in the browser, and both import from
 * here.
 *
 * The whole catalogue is a few dozen documents, so this is a scan, not an
 * inverted index. What it does need is to be forgiving: travellers type
 * "punaka", "tsechu" and "jomolari", and the spellings on the site are
 * Punakha, tshechu and Jomolhari. One edit of slack on a longer word covers
 * nearly all of it.
 */

export const SEARCH_KINDS = ['journey', 'place', 'culture', 'journal', 'activity', 'page'] as const
export type SearchKind = (typeof SEARCH_KINDS)[number]

export const KIND_LABEL: Record<SearchKind, string> = {
  journey: 'Journeys',
  place: 'Places',
  culture: 'Culture',
  journal: 'Journal',
  activity: 'Activities',
  page: 'Pages',
}

export type SearchDoc = {
  kind: SearchKind
  title: string
  path: string
  /** The line shown under the title. */
  summary: string
  /** A short fact line: "11 days · Festival", "Valley", a date. */
  meta: string
  image: string | null
  /** Names that should find this document but are not in its title: regions, tags, a parent valley. */
  keywords: string
  /** The body as plain text, trimmed. Searched, never shown whole. */
  body: string
}

export type SearchHit = SearchDoc & { score: number }

/** Lower case, accents folded, punctuation to spaces. "Dzong’s" and "dzongs" meet. */
export function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function terms(query: string): string[] {
  return [...new Set(normalise(query).split(' ').filter((t) => t.length > 1 || /\d/.test(t)))]
}

/** Weight of a term matching in each field. A title match outranks a body mention. */
const WEIGHT = { title: 10, keywords: 5, summary: 3, body: 1 } as const
type Field = keyof typeof WEIGHT

/**
 * Less than any real difference in match, so it only settles ties: when a
 * journey and a journal entry are both called "Jomolhari", the journey — the
 * thing a traveller can book — comes first, then the place.
 */
const TIE_BREAK: Record<SearchKind, number> = { journey: 0.5, place: 0.3, culture: 0.1, journal: 0, activity: 0, page: 0 }

type Prepared = { doc: SearchDoc; text: Record<Field, string>; words: Record<Field, string[]> }

export function prepare(docs: SearchDoc[]): Prepared[] {
  return docs.map((doc) => {
    const text = {
      title: normalise(doc.title),
      keywords: normalise(doc.keywords),
      summary: normalise(doc.summary),
      body: normalise(doc.body),
    }
    const words = {
      title: text.title.split(' '),
      keywords: text.keywords.split(' '),
      summary: text.summary.split(' '),
      body: text.body.split(' '),
    }
    return { doc, text, words }
  })
}

/**
 * Every term has to match somewhere — "festival paro" is a narrower question
 * than "festival", not a wider one. Within a field a whole word scores most, a
 * word it begins scores less (so "trek" finds "trekking"), and a near-miss
 * spelling least.
 */
export function search(index: Prepared[], query: string): SearchHit[] {
  const qs = terms(query)
  if (!qs.length) return []

  const hits: SearchHit[] = []
  for (const { doc, text, words } of index) {
    let score = 0
    let all = true
    for (const q of qs) {
      let best = 0
      for (const field of Object.keys(WEIGHT) as Field[]) {
        const m = matchStrength(q, text[field], words[field])
        if (m) best = Math.max(best, m * WEIGHT[field])
      }
      if (!best) {
        all = false
        break
      }
      score += best
    }
    if (!all) continue
    // The whole query as a phrase in the title: "tiger's nest" over two stray words.
    if (qs.length > 1 && text.title.includes(qs.join(' '))) score += 20
    hits.push({ ...doc, score: score + TIE_BREAK[doc.kind] })
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
}

function matchStrength(q: string, text: string, words: string[]): number {
  if (!text) return 0
  if (words.includes(q)) return 1
  if (words.some((w) => w.startsWith(q))) return 0.7
  if (q.length >= 4 && text.includes(q)) return 0.5
  if (q.length >= 5 && words.some((w) => withinOneEdit(q, w))) return 0.4
  return 0
}

/** True when `a` becomes `b` by one insertion, deletion or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return a === b
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/**
 * The line to show under a result's title.
 *
 * The summary, unless the words were found only in the body — then the part of
 * the body that has them, so "visa" on Travellers' information shows the
 * sentence about visas rather than a lead about something else.
 */
export function excerpt(doc: SearchDoc, query: string, length = 180): string {
  const qs = terms(query)
  const folded = normalise(doc.summary)
  if (!qs.length || !doc.body || qs.some((q) => folded.includes(q))) return doc.summary

  const lower = doc.body.toLowerCase()
  const at = qs.map((q) => lower.indexOf(q)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (at === undefined) return doc.summary

  let start = Math.max(0, at - Math.round(length / 3))
  // Start on a word, not halfway through one.
  if (start > 0) start = doc.body.indexOf(' ', start) + 1 || start
  const end = Math.min(doc.body.length, start + length)
  return `${start > 0 ? '… ' : ''}${doc.body.slice(start, end).trim()}${end < doc.body.length ? ' …' : ''}`
}

/**
 * Splits `text` into runs, marking the ones that match a query term, for
 * highlighting. Matching is on the folded form, so the runs keep the
 * original's accents and capitals.
 */
export function highlight(text: string, query: string): { text: string; match: boolean }[] {
  const qs = terms(query)
  if (!qs.length) return [{ text, match: false }]
  const pattern = new RegExp(`(${qs.map(escapeRegExp).join('|')})`, 'gi')
  const folded = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  // Folding can change the length of a string with combining marks; when it
  // does, highlighting against the folded copy would cut words in half.
  const source = folded.length === text.length ? folded : text
  const runs: { text: string; match: boolean }[] = []
  let last = 0
  for (const m of source.matchAll(pattern)) {
    const at = m.index ?? 0
    if (at > last) runs.push({ text: text.slice(last, at), match: false })
    runs.push({ text: text.slice(at, at + m[0].length), match: true })
    last = at + m[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last), match: false })
  return runs
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
