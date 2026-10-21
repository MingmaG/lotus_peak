'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Tabs } from '@/design-system'
import {
  KIND_LABEL,
  excerpt,
  highlight,
  prepare,
  search,
  type SearchDoc,
  type SearchHit,
  type SearchKind,
} from '@/lib/search'
import { useInquiry } from '@/sections/shared/SiteChrome'

const PLACEHOLDER = 'A valley, a festival, a word…'

/** How many of each kind the "All" view shows before offering the rest. */
const PER_GROUP = 4

/**
 * The search box and what it finds.
 *
 * The query lives in the URL (`?q=`), so a search is shareable, survives a
 * reload and the back button returns to it. It is read here with
 * `useSearchParams` rather than by the page, which is what keeps `/search`
 * prerendered — the same trade the journeys filter makes.
 *
 * The index is fetched on each visit rather than kept on a module-level
 * variable: a copy held there outlives a publish for as long as the tab stays
 * open. The browser's HTTP cache already stops it being downloaded twice.
 */
export function SearchView() {
  const router = useRouter()
  const params = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const { open } = useInquiry()

  const [query, setQuery] = useState(urlQuery)
  const [docs, setDocs] = useState<SearchDoc[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [kind, setKind] = useState<SearchKind | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  // A search from the navigation lands here with the words already in the
  // URL; one made on this page is already in the box, and taking the URL's
  // trimmed copy back would eat the space after a word as it is typed.
  useEffect(() => setQuery((q) => (q.trim() === urlQuery ? q : urlQuery)), [urlQuery])

  useEffect(() => {
    let live = true
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SearchDoc[]) => live && setDocs(d))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!urlQuery) inputRef.current?.focus()
    // Only on arrival: refocusing on every keystroke would fight the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The URL follows the box, replaced rather than pushed so that the back
  // button leaves search instead of stepping back one letter at a time.
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim() === urlQuery) return
      const next = query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search'
      router.replace(next, { scroll: false })
    }, 250)
    return () => clearTimeout(t)
  }, [query, urlQuery, router])

  const index = useMemo(() => (docs ? prepare(docs) : null), [docs])
  const hits = useMemo(() => (index ? search(index, query) : []), [index, query])

  // Groups in the order of their best result, which is the order `hits` is
  // already in. A fixed order put three journeys that mention kira in passing
  // above the article called "Kira and gho".
  const byKind = useMemo(() => {
    const groups = new Map<SearchKind, SearchHit[]>()
    for (const h of hits) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h])
    return [...groups].map(([kind, list]) => ({ kind, hits: list }))
  }, [hits])

  // A tab for a kind that no longer has results would be a tab onto nothing.
  useEffect(() => {
    if (kind !== 'all' && !byKind.some((g) => g.kind === kind)) setKind('all')
  }, [byKind, kind])

  const tabLabel = (k: SearchKind | 'all', n: number) => `${k === 'all' ? 'All' : KIND_LABEL[k]} ${n}`
  const tabEntries: [label: string, kind: SearchKind | 'all'][] = [
    [tabLabel('all', hits.length), 'all'],
    ...byKind.map((g): [string, SearchKind] => [tabLabel(g.kind, g.hits.length), g.kind]),
  ]
  const kindOfTab = new Map(tabEntries)
  const current = tabEntries.find(([, k]) => k === kind)?.[0] ?? tabLabel('all', hits.length)

  const trimmed = query.trim()
  const status = failed
    ? 'Search is not available just now.'
    : !docs
      ? trimmed
        ? 'Searching…'
        : ''
      : !trimmed
        ? ''
        : hits.length
          ? `${hits.length} ${hits.length === 1 ? 'result' : 'results'} for “${trimmed}”`
          : `Nothing matches “${trimmed}”.`

  return (
    <div style={{ display: 'grid', gap: 'var(--space-7)' }}>
      <form
        role="search"
        action="/search"
        method="get"
        onSubmit={(e) => {
          e.preventDefault()
          inputRef.current?.blur()
        }}
        className="lp-search-field"
      >
        <label htmlFor="lp-search-q" className="lp-sr-only">
          Search journeys, places, culture and the journal
        </label>
        <input
          ref={inputRef}
          id="lp-search-q"
          name="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDER}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <SearchGlyph />
      </form>

      <p aria-live="polite" style={{ margin: 0, color: 'var(--text-muted)', minHeight: '1.5em' }}>
        {status}
      </p>

      {hits.length > 0 && (
        <>
          {byKind.length > 1 && (
            <Tabs
              aria-label="Filter results by kind"
              tabs={tabEntries.map(([label]) => label)}
              value={current}
              onChange={(t) => setKind(kindOfTab.get(t) ?? 'all')}
            />
          )}

          {kind === 'all' ? (
            byKind.map((g) => (
              <section key={g.kind} aria-labelledby={`lp-search-${g.kind}`} style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <h2
                  id={`lp-search-${g.kind}`}
                  style={{
                    fontSize: 'var(--text-label)',
                    letterSpacing: 'var(--tracking-label)',
                    textTransform: 'uppercase',
                    fontWeight: 'var(--weight-medium)',
                    color: 'var(--text-accent)',
                  }}
                >
                  {KIND_LABEL[g.kind]}
                </h2>
                <Results hits={g.hits.slice(0, PER_GROUP)} query={trimmed} />
                {g.hits.length > PER_GROUP && byKind.length > 1 && (
                  <div>
                    <Button variant="ghost" onClick={() => setKind(g.kind)}>
                      All {g.hits.length} in {KIND_LABEL[g.kind].toLowerCase()}
                    </Button>
                  </div>
                )}
              </section>
            ))
          ) : (
            <Results hits={byKind.find((g) => g.kind === kind)?.hits ?? []} query={trimmed} />
          )}
        </>
      )}

      {docs && trimmed && !hits.length && (
        <div style={{ display: 'grid', gap: 'var(--space-5)', justifyItems: 'start' }}>
          <p style={{ margin: 0, maxWidth: 'var(--measure-narrow)', color: 'var(--text-muted)' }}>
            Try a shorter word, or the name of a valley. If you are looking for something we do not
            write about here, ask us: most of what we arrange is not on a page.
          </p>
          <Button variant="outline" onClick={() => open()}>
            Ask us
          </Button>
        </div>
      )}
    </div>
  )
}

function Results({ hits, query }: { hits: SearchHit[]; query: string }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
      {hits.map((h) => (
        <li key={h.path} style={{ borderTop: 'var(--hairline)' }}>
          <Link href={h.path} className="lp-search-hit">
            <span className="lp-search-thumb" aria-hidden="true">
              {h.image && <Image src={h.image} alt="" fill sizes="120px" style={{ objectFit: 'cover' }} />}
            </span>
            <span style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 'var(--text-micro)',
                  letterSpacing: 'var(--tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}
              >
                {h.meta}
              </span>
              <span style={{ fontSize: 'var(--text-h3)', lineHeight: 'var(--leading-heading)', color: 'var(--ink)' }}>
                <Marked text={h.title} query={query} />
              </span>
              <span style={{ color: 'var(--text-muted)', lineHeight: 'var(--leading-body)' }}>
                <Marked text={excerpt(h, query)} query={query} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

function Marked({ text, query }: { text: string; query: string }) {
  return highlight(text, query).map((run, i) => (run.match ? <mark key={i}>{run.text}</mark> : <span key={i}>{run.text}</span>))
}

/**
 * The box as the static HTML has it, before the view can read the URL. A
 * plain GET form, so it still submits with scripts off.
 */
export function SearchFieldFallback() {
  return (
    <form role="search" action="/search" method="get" className="lp-search-field">
      <label htmlFor="lp-search-q" className="lp-sr-only">
        Search journeys, places, culture and the journal
      </label>
      <input id="lp-search-q" name="q" type="search" placeholder={PLACEHOLDER} autoComplete="off" />
      <SearchGlyph />
    </form>
  )
}

function SearchGlyph() {
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: 18, height: 18, flexShrink: 0 }}>
      <span
        style={{ position: 'absolute', left: 0, top: 0, width: 13, height: 13, border: '1.5px solid currentColor', borderRadius: '50%' }}
      />
      <span
        style={{
          position: 'absolute',
          right: 0,
          bottom: 1,
          width: 7,
          height: 1.5,
          background: 'currentColor',
          transform: 'rotate(45deg)',
          transformOrigin: 'right',
        }}
      />
    </span>
  )
}
