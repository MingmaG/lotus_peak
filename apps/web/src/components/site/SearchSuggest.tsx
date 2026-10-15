'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  KIND_LABEL,
  highlight,
  prepare,
  search,
  type SearchDoc,
  type SearchHit,
} from '@/lib/search'

/**
 * The navigation's search box, answering as it is typed.
 *
 * The box itself is old; what is new is that it shows what it has found before
 * you press Enter. Three things make that affordable, and all three are
 * properties of this site rather than clever code:
 *
 * - **The index is a static file.** `/search-index.json` is built with the
 *   pages and invalidated by the same publish, so a keystroke costs nothing on
 *   the server — the ranking in `lib/search.ts` runs here, over a few dozen
 *   documents.
 * - **It is fetched on the first focus, not on load.** Every page would
 *   otherwise carry the index for the visitors who never search, which is most
 *   of them.
 * - **The form still works without it.** What this wraps is a real GET form to
 *   `/search`, so with no JavaScript, or before hydration, or if the index
 *   cannot be fetched, typing and pressing Enter goes to the search page and
 *   searches there. The suggestions are an improvement on that, never the only
 *   way through.
 *
 * ## Why not a `<datalist>`
 *
 * Because a result is a line of three parts — what kind of thing it is, its
 * title and a photograph — and a datalist draws a string. The pattern here is
 * the combobox one: `role="combobox"` on the input, `role="listbox"` beside
 * it, `aria-activedescendant` naming the option the arrow keys are on, and the
 * count announced politely. The mouse and the keyboard reach the same rows.
 */

/** How many suggestions are offered. Enough to recognise, few enough to read. */
const SUGGESTIONS = 6

/** Below this nothing is searched: one letter matches most of the site. */
const MIN_QUERY = 2

export interface SearchSuggestProps {
  placeholder: string
  /** The accessible name. The visible label is the glyph beside the box. */
  label?: string
  className?: string
  style?: CSSProperties
  /**
   * Called when a suggestion is followed.
   *
   * The navigation uses it to close the menu panel: a client-side navigation
   * leaves the panel open over the page it just moved to.
   */
  onNavigate?: () => void
  /** Where the panel hangs. The bar's box is on the right of a wide header. */
  align?: 'left' | 'right'
}

export function SearchSuggest({
  placeholder,
  label = 'Search',
  className,
  style,
  onNavigate,
  align = 'left',
}: SearchSuggestProps) {
  const router = useRouter()
  const id = useId()
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<SearchDoc[] | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrap = useRef<HTMLSpanElement>(null)

  /**
   * The index, fetched once per mount on the first focus.
   *
   * Not held on a module-level variable: a copy there outlives a publish for
   * as long as the tab is open, and the browser's HTTP cache already stops it
   * being downloaded twice. The same reasoning as `SearchView`.
   */
  const asked = useRef(false)
  const load = () => {
    if (asked.current) return
    asked.current = true
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SearchDoc[]) => setDocs(d))
      .catch(() => setDocs([]))
  }

  const index = useMemo(() => (docs ? prepare(docs) : null), [docs])
  const trimmed = query.trim()
  const hits = useMemo(
    () =>
      index && trimmed.length >= MIN_QUERY ? search(index, trimmed).slice(0, SUGGESTIONS) : [],
    [index, trimmed],
  )

  /* A query that changed is a list that changed: an arrow key should start
     from the top of the new one rather than the position in the old. */
  useEffect(() => setActive(-1), [trimmed])

  /* Closing on a click elsewhere. Pointer rather than click, so a drag that
     starts outside the panel does not leave it open behind the selection. */
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const go = (path: string) => {
    setQuery('')
    setOpen(false)
    setActive(-1)
    onNavigate?.()
    router.push(path)
  }

  const showing = open && trimmed.length >= MIN_QUERY

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      /* Escape closes the suggestions and keeps the words. A second Escape is
         the browser's own "clear the search field", which is still wanted. */
      if (showing) {
        event.preventDefault()
        setOpen(false)
      }
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!hits.length) return
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      /* One past each end is "no option", which is how the box gets back to
         what was typed — and what makes Enter mean "search for this" again. */
      setActive((at) => {
        const next = at + step
        if (next < -1) return hits.length - 1
        if (next >= hits.length) return -1
        return next
      })
      return
    }

    if (event.key === 'Enter' && active >= 0 && hits[active]) {
      /* A chosen suggestion goes to that page. Enter with nothing chosen falls
         through to the form, which submits to /search. */
      event.preventDefault()
      go(hits[active].path)
    }
  }

  return (
    <span ref={wrap} style={{ position: 'relative', display: 'contents' }}>
      <input
        type="search"
        name="q"
        value={query}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={className}
        style={style}
        role="combobox"
        aria-expanded={showing && hits.length > 0}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
        onFocus={load}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          load()
        }}
        onKeyDown={onKeyDown}
      />

      <span className="lp-sr-only" aria-live="polite">
        {showing && docs
          ? hits.length
            ? `${hits.length} ${hits.length === 1 ? 'suggestion' : 'suggestions'}`
            : 'No suggestions'
          : ''}
      </span>

      {showing && (hits.length > 0 || docs) && (
        <div
          className="lp-suggest"
          data-align={align}
          /* The panel is a sibling of the input inside the form, so a pointer
             press on a row does not blur-and-submit before the click lands. */
        >
          {hits.length > 0 ? (
            <ul id={`${id}-listbox`} role="listbox" aria-label="Suggestions">
              {hits.map((hit, at) => (
                <li
                  key={hit.path}
                  id={`${id}-option-${at}`}
                  role="option"
                  aria-selected={at === active}
                  data-active={at === active ? 'true' : undefined}
                  onPointerEnter={() => setActive(at)}
                  /* `onClick` on the row rather than a nested link: the row is
                     the option, and a link inside an option is two things in
                     the accessibility tree where the design draws one. The
                     path still reaches the page through the router. */
                  onClick={() => go(hit.path)}
                >
                  <Row hit={hit} query={trimmed} />
                </li>
              ))}
              <li className="lp-suggest-all" onClick={() => go(`/search?q=${encodeURIComponent(trimmed)}`)}>
                Everything for “{trimmed}”
              </li>
            </ul>
          ) : (
            <p id={`${id}-listbox`} className="lp-suggest-empty">
              Nothing matches “{trimmed}”. Try a shorter word, or the name of a valley.
            </p>
          )}
        </div>
      )}
    </span>
  )
}

function Row({ hit, query }: { hit: SearchHit; query: string }) {
  return (
    <>
      <span className="lp-suggest-thumb" aria-hidden="true">
        {hit.image && <Image src={hit.image} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />}
      </span>
      <span className="lp-suggest-text">
        <span className="lp-suggest-kind">{KIND_LABEL[hit.kind]}</span>
        <span className="lp-suggest-title">
          {highlight(hit.title, query).map((run, i) =>
            run.match ? <mark key={i}>{run.text}</mark> : <span key={i}>{run.text}</span>,
          )}
        </span>
      </span>
    </>
  )
}
