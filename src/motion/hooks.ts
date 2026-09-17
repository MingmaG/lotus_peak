'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { subscribe, type Frame } from './ScrollBroker'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * One reduced-motion hook, consumed by every effect (audit B6).
 * Starts `false` so the server and the first client render agree; the real
 * value lands in a layout effect, before paint.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  return reduced
}

/**
 * Enter-viewport detection for Reveal.
 * If the element is already in view at mount we set the flag in a layout
 * effect, before paint, so there is no flash at opacity 0 (audit B4).
 */
export function useInView<T extends HTMLElement>(
  rootMargin = '0px 0px -12% 0px',
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 1.05 && rect.bottom > 0) {
      setInView(true)
      return
    }
    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin, threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return [ref, inView]
}

/** Flips to true `ms` after `on` becomes true. Used to drop will-change. */
export function useDelayedFlag(on: boolean, ms: number): boolean {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!on) return
    const t = setTimeout(() => setDone(true), ms)
    return () => clearTimeout(t)
  }, [on, ms])
  return done
}

/**
 * Parallax. Ported verbatim from the design project's useParallax:
 *   p  = (rect.top + rect.height / 2 - vh / 2) / (vh + rect.height)   // -0.5 … 0.5
 *   ty = -p * speed * 100
 * The 1.14 overscan is what keeps the image covering the frame at full offset.
 */
export function useParallax<C extends HTMLElement, I extends HTMLElement>(
  speed: number,
): [React.RefObject<C | null>, React.RefObject<I | null>] {
  const container = useRef<C>(null)
  const image = useRef<I>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = container.current
    const img = image.current
    if (!el || !img || reduced) return

    return subscribe(
      el,
      (node, frame: Frame) => {
        const r = node.getBoundingClientRect()
        return (r.top + r.height / 2 - frame.vh / 2) / (frame.vh + r.height)
      },
      (_node, p: number) => {
        img.style.transform = `translate3d(0, ${(-p * speed * 100).toFixed(2)}px, 0) scale(1.14)`
      },
    )
  }, [speed, reduced])

  return [container, image]
}

/** Scroll progress of the whole document, 0 … 0.999. Drives Dignities. */
export function useDocumentProgress(onChange: (p: number) => void): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return subscribe(
      el,
      (_node, frame: Frame) => {
        const max = Math.max(1, frame.docHeight - frame.vh)
        return Math.min(0.999, Math.max(0, frame.scrollY / max))
      },
      (_node, p: number) => cb.current(p),
    )
  }, [])

  return ref
}
