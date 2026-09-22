'use client'

/**
 * The single scroll listener for the whole page (audit B10).
 *
 * Every scroll-driven effect subscribes here. One passive `scroll` listener,
 * one `resize` listener, one ResizeObserver on <body>, one rAF loop.
 * Each frame runs ALL reads, then ALL writes, so layout is never thrashed.
 */

export type Frame = { scrollY: number; vh: number; docHeight: number }
type Reader<T> = (el: Element, frame: Frame) => T | null
type Writer<T> = (el: HTMLElement, value: T) => void

type Sub = {
  el: HTMLElement
  read: Reader<unknown>
  write: Writer<unknown>
  value: unknown
  active: boolean
}

const subs = new Set<Sub>()
let raf = 0
let started = false
let docHeight = 0
let bodyObserver: ResizeObserver | null = null

function measureDoc() {
  docHeight = document.documentElement.scrollHeight
}

function tick() {
  raf = 0
  const frame: Frame = {
    scrollY: window.scrollY,
    vh: window.innerHeight,
    docHeight,
  }

  // Read phase — may touch layout, must not mutate it.
  for (const sub of subs) {
    const rect = sub.el.getBoundingClientRect()
    // Skip anything comfortably offscreen. Fixed layers (height >= vh at top 0)
    // still qualify, which is what we want for Dignities.
    sub.active = rect.bottom > -200 && rect.top < frame.vh + 200
    sub.value = sub.active ? sub.read(sub.el, frame) : null
  }

  // Write phase — may mutate, must not read layout.
  for (const sub of subs) {
    if (sub.active && sub.value !== null) sub.write(sub.el, sub.value)
  }
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(tick)
}

function start() {
  if (started) return
  started = true
  measureDoc()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('load', onResize)
  if ('ResizeObserver' in window) {
    bodyObserver = new ResizeObserver(onResize)
    bodyObserver.observe(document.body)
  }
  schedule()
}

function onResize() {
  measureDoc()
  schedule()
}

function stop() {
  if (!started) return
  started = false
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('load', onResize)
  bodyObserver?.disconnect()
  bodyObserver = null
  cancelAnimationFrame(raf)
  raf = 0
}

export function subscribe<T>(el: HTMLElement, read: Reader<T>, write: Writer<T>): () => void {
  const sub: Sub = {
    el,
    read: read as Reader<unknown>,
    write: write as Writer<unknown>,
    value: null,
    active: false,
  }
  subs.add(sub)
  start()
  schedule()

  if (process.env.NODE_ENV !== 'production' && subs.size > 8) {
    console.warn(
      `[motion] ${subs.size} scroll subscribers active. The budget is 6 parallax ` +
        `layers per viewport — see docs/specs/03-motion-and-effects.md §8.`,
    )
  }

  return () => {
    subs.delete(sub)
    if (subs.size === 0) stop()
  }
}

/** Document height as last measured by the broker. Used by Dignities (audit B7). */
export function getDocHeight() {
  return docHeight
}
