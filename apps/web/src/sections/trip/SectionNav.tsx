'use client'

import { useEffect, useState } from 'react'
import { subscribe } from '@/motion'

export const SECTIONS: [id: string, label: string][] = [
  ['overview', 'Overview'],
  ['highlights', 'Highlights'],
  ['enquiry', 'Enquiry'],
  ['itinerary', 'Itinerary'],
  ['included', 'Included'],
  ['essential', 'Essential info'],
  ['reflections', 'Reflections'],
]

/**
 * Sticky sub-nav with scroll-spy.
 *
 * `top` and the jump offset both come from --nav-h, which NavBar measures, so
 * the two never drift apart as the nav changes height (audit B8). The spy rides
 * the shared scroll broker rather than adding a listener of its own (B10).
 */
export function SectionNav() {
  const [active, setActive] = useState(SECTIONS[0]![0])

  useEffect(() => {
    // A hash arriving in the URL wins until the reader scrolls.
    const hash = window.location.hash.slice(1)
    if (hash && SECTIONS.some(([id]) => id === hash)) setActive(hash)
  }, [])

  useEffect(() => {
    const el = document.getElementById('trip-section-nav')
    if (!el) return
    return subscribe(
      el,
      () => {
        let current = SECTIONS[0]![0]
        for (const [id] of SECTIONS) {
          const node = document.getElementById(id)
          if (node && node.getBoundingClientRect().top < 220) current = id
        }
        return current
      },
      (_node, id: string) => setActive(id),
    )
  }, [])

  const jump = (id: string) => {
    const node = document.getElementById(id)
    if (!node) return
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 88
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - (navH + 56), behavior: 'smooth' })
    node.setAttribute('tabindex', '-1')
    node.focus({ preventScroll: true })
  }

  return (
    <nav
      id="trip-section-nav"
      aria-label="Sections"
      style={{
        position: 'sticky',
        top: 'calc(var(--nav-h) - 1px)',
        zIndex: 40,
        background: 'var(--surface-page)',
        borderBottom: '1px solid var(--border-hairline)',
        padding: '0 var(--gutter)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--container)',
          margin: '0 auto',
          display: 'flex',
          gap: 40,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {SECTIONS.map(([id, label]) => {
          const on = active === id
          return (
            <button
              key={id}
              type="button"
              aria-current={on ? 'true' : undefined}
              onClick={() => jump(id)}
              style={{
                background: 'none',
                border: 0,
                borderBottom: `1px solid ${on ? 'var(--saffron)' : 'transparent'}`,
                marginBottom: -1,
                padding: '18px 0',
                fontFamily: 'inherit',
                fontSize: 'var(--text-label)',
                fontWeight: 500,
                letterSpacing: 'var(--tracking-nav)',
                textTransform: 'uppercase',
                color: on ? 'var(--ink)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition:
                  'color var(--dur-quick) var(--ease-breath),border-color var(--dur-quick) var(--ease-breath)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
