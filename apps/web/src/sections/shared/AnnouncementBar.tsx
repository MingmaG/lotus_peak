'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Announcement } from '@/content/types'
import { appliesTo, isRunning, useClosed, useNoticeClock } from '@/lib/notices'
import { usePrefersReducedMotion } from '@/motion'

/**
 * The bar above the navigation.
 *
 * In flow, not fixed: it scrolls away with the page and the navigation, which
 * is sticky, takes the top of the screen from there. Heroes pull up under the
 * navigation by `--nav-h` and are unaffected — they start beneath the bar.
 *
 * Several announcements take turns in one bar rather than stacking, so the
 * page never opens with three coloured stripes above its photograph. They
 * share one grid cell, which makes the bar as tall as the longest of them, so
 * changing message never moves the page. Each one stays for two breaths and
 * crossfades slowly; hovering or focusing holds it; under reduced motion it
 * does not turn on its own at all and the arrows are the way through.
 *
 * No countdown and no ticking clock, whatever the announcement is about. The
 * design forbids urgency (apps/web/CLAUDE.md §1); the dates decide when it
 * shows, and the words say what they say.
 */

/** How long each one stays: two of the design's breaths, read from `--dur-breath`. */
const DWELL_BREATHS = 2

function breathMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-breath').trim()
  const seconds = parseFloat(raw)
  /* Only a token that failed to load reaches the fallback, and then 8s is what it says. */
  return Number.isFinite(seconds) && seconds > 0 ? seconds * (raw.endsWith('ms') ? 1 : 1000) : 8000
}

const TONE: Record<Announcement['tone'], CSSProperties> = {
  general: tone('general'),
  offer: tone('offer'),
  advisory: tone('advisory'),
  festival: tone('festival'),
}

function tone(name: Announcement['tone']): CSSProperties {
  return {
    background: `var(--notice-${name}-bg)`,
    color: `var(--notice-${name}-fg)`,
    ['--notice-chip-bg' as string]: `var(--notice-${name}-chip-bg)`,
    ['--notice-chip-fg' as string]: `var(--notice-${name}-chip-fg)`,
    ['--notice-link' as string]: `var(--notice-${name}-link)`,
  }
}

export function AnnouncementBar({
  announcements,
  pathname,
  renderedAt,
}: {
  announcements: Announcement[]
  pathname: string
  renderedAt: number
}) {
  const now = useNoticeClock(renderedAt, announcements)
  const [closed, close] = useClosed()
  const reduced = usePrefersReducedMotion()

  const shown = useMemo(
    () =>
      announcements.filter(
        (a) => appliesTo(a, pathname) && isRunning(a, now) && closed[a.id] !== a.version,
      ),
    [announcements, pathname, now, closed],
  )

  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)
  const count = shown.length
  const current = count ? index % count : 0

  useEffect(() => {
    if (count < 2 || held || reduced) return
    const timer = setTimeout(() => setIndex((i) => i + 1), DWELL_BREATHS * breathMs())
    return () => clearTimeout(timer)
  }, [count, held, reduced, current])

  if (count === 0) return null

  const active = shown[current]!

  return (
    <section
      aria-label="Announcements"
      aria-roledescription={count > 1 ? 'carousel' : undefined}
      className="lp-notice-bar"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false)
      }}
      style={{
        ...TONE[active.tone],
        position: 'relative',
        zIndex: 51,
        transition: 'background-color var(--dur-turn) var(--ease-breath), color var(--dur-turn) var(--ease-breath)',
        boxShadow: active.tone === 'offer' || active.tone === 'festival' ? 'inset 0 -1px 0 var(--notice-rule)' : undefined,
      }}
    >
      <div className="lp-notice-inner">
        {count > 1 ? (
          <div className="lp-notice-steps" aria-label={`${current + 1} of ${count}`}>
            <StepButton label="Previous announcement" onClick={() => setIndex(current - 1 + count)} dir="prev" />
            <span aria-hidden="true" className="lp-notice-count">
              {current + 1}/{count}
            </span>
            <StepButton label="Next announcement" onClick={() => setIndex(current + 1)} dir="next" />
          </div>
        ) : (
          <span className="lp-notice-spacer" aria-hidden="true" />
        )}

        <div className="lp-notice-stack">
          {shown.map((a, i) => (
            <div
              key={a.id}
              data-notice={`${a.id}:${a.version}`}
              aria-hidden={i !== current}
              // `inert` keeps the links of the hidden ones out of the tab order.
              {...(i !== current ? { inert: true } : {})}
              className="lp-notice-slide"
              style={{
                opacity: i === current ? 1 : 0,
                visibility: i === current ? 'visible' : 'hidden',
                transition:
                  'opacity var(--dur-turn) var(--ease-breath), visibility 0s linear ' +
                  (i === current ? '0s' : 'var(--dur-turn)'),
              }}
            >
              {a.label && <span className="lp-notice-chip">{a.label}</span>}
              <div className="lp-notice lp-notice-text" dangerouslySetInnerHTML={{ __html: a.message }} />
              {a.href && <NoticeLink href={a.href} label={a.linkLabel || 'Read more'} />}
            </div>
          ))}
        </div>

        {active.dismissible ? (
          <button
            type="button"
            className="lp-notice-close"
            aria-label="Close this announcement"
            onClick={() => close(active.id, active.version)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span className="lp-notice-spacer" aria-hidden="true" />
        )}
      </div>
    </section>
  )
}

function NoticeLink({ href, label }: { href: string; label: string }) {
  const external = /^https?:\/\//i.test(href)
  const content = (
    <>
      {label}
      <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
        <path d="M1 5h11M8.5 1.5L12 5 8.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </>
  )
  return external ? (
    <a className="lp-notice-link" href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <Link className="lp-notice-link" href={href}>
      {content}
    </Link>
  )
}

function StepButton({ label, onClick, dir }: { label: string; onClick: () => void; dir: 'prev' | 'next' }) {
  return (
    <button type="button" className="lp-notice-step" aria-label={label} onClick={onClick}>
      <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
        <path
          d={dir === 'prev' ? 'M6.5 1L1.5 6l5 5' : 'M1.5 1l5 5-5 5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    </button>
  )
}
