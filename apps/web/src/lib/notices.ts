'use client'

import { useCallback, useEffect, useState } from 'react'
import type { NoticeSchedule } from '@/content/types'
import { CLOSED_NOTICES_KEY } from './notice-script'

/**
 * When and where an announcement or a banner shows.
 *
 * Decided in the browser, and that is the point of this module. Every page of
 * this site is prerendered, so the HTML a visitor receives may be an hour old —
 * older, if the push from the panel was lost. An offer that ends at noon must
 * stop at noon, not at the next rebuild, and one that starts at ten must start
 * on a page built at nine. The panel sends every notice that has not ended,
 * started or not, and this compares them against the visitor's clock.
 *
 * The first render — on the server and during hydration — uses the moment the
 * page was rendered instead of `Date.now()`, so the two agree and React has
 * nothing to complain about. The real clock takes over once mounted.
 */

/* ------------------------------------------------------------------ path */

function normalise(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/** `/trips/*` matches `/trips` and everything below it; anything else is exact. */
function matches(pattern: string, path: string): boolean {
  const p = normalise(pattern)
  if (p.endsWith('/*')) {
    const stem = p.slice(0, -2)
    return path === stem || path.startsWith(`${stem}/`) || stem === ''
  }
  return p === path
}

export function appliesTo(schedule: NoticeSchedule, pathname: string): boolean {
  const path = normalise(pathname)
  if (schedule.hideOn.some((pattern) => matches(pattern, path))) return false
  return schedule.showOn.length === 0 || schedule.showOn.some((pattern) => matches(pattern, path))
}

/* ------------------------------------------------------------------ time */

export function isRunning(schedule: NoticeSchedule, now: number): boolean {
  if (schedule.startsAt && Date.parse(schedule.startsAt) > now) return false
  if (schedule.endsAt && Date.parse(schedule.endsAt) <= now) return false
  return true
}

/** No wait is longer than a minute, so a laptop woken from sleep catches up. */
const MAX_WAIT_MS = 60_000

/**
 * The time, re-read at the next moment any of these notices starts or ends.
 *
 * Not a one-second ticker. It sleeps until the nearest boundary — or a minute,
 * whichever is sooner — and wakes on the tab becoming visible again, which is
 * when a visitor returning to a tab left open overnight would otherwise see
 * yesterday's offer.
 */
export function useNoticeClock(renderedAt: number, schedules: NoticeSchedule[]): number {
  const [now, setNow] = useState(renderedAt)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = () => {
      const t = Date.now()
      setNow(t)
      let next = t + MAX_WAIT_MS
      for (const s of schedules) {
        for (const iso of [s.startsAt, s.endsAt]) {
          const at = iso ? Date.parse(iso) : NaN
          if (at > t && at < next) next = at
        }
      }
      clearTimeout(timer)
      /* A beat past the boundary, so the comparison above lands on the far side. */
      timer = setTimeout(tick, next - t + 250)
    }

    const onVisible = () => document.visibilityState === 'visible' && tick()
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [schedules])

  return now
}

/* ------------------------------------------------------------- dismissal */

/**
 * What this visitor has closed, as `{ id: version }`.
 *
 * Browser storage, because it is a convenience for one visitor and nothing
 * else: lose it and they see a bar again, which is harmless. Keyed by version
 * so that editing a notice shows it again to people who closed the old words.
 * Every access is guarded — a private window or blocked storage throws, and a
 * notice that cannot remember being closed must still be closable.
 */
const KEY = CLOSED_NOTICES_KEY

function read(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function rememberClosed(id: string, version: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: version }))
  } catch {
    /* Storage refused. It closes for this page view, which is what was asked. */
  }
}

/** The closed set, read once mounted. Empty on the server and on first paint. */
export function useClosed(): [Record<string, string>, (id: string, version: string) => void] {
  const [closed, setClosed] = useState<Record<string, string>>({})
  useEffect(() => setClosed(read()), [])
  /* Stable, so a caller can put it in an effect's dependencies. */
  const markClosed = useCallback((id: string, version: string) => {
    rememberClosed(id, version)
    setClosed((current) => ({ ...current, [id]: version }))
  }, [])
  return [closed, markClosed]
}
