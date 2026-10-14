'use client'

import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { usePrefersReducedMotion } from '@/motion'

/**
 * One photograph at a time, over the page, and the dialog it sits in.
 *
 * This was written inside the journey gallery and lives here because two
 * places now open a photograph full-size — the gallery band and a day's own
 * strip in the itinerary. A second copy would be a second set of keyboard
 * bindings, a second focus trap and a second idea of what Escape does, and
 * the one that drifted would be the one nobody was looking at.
 *
 * `showModal()` is what buys the focus trap, the inert page behind, Escape and
 * the focus restore — the three things `InquiryDrawer` had to write by hand.
 * It stacks, so Escape in the viewer returns to the sheet it was opened from
 * rather than closing both.
 *
 * Nothing inside a dialog renders until it opens. These pages are prerendered,
 * and a viewer holding forty full-width photographs in its closed state would
 * be forty downloads for somebody who never opens it.
 */

/**
 * What the viewer needs of a photograph.
 *
 * Declared structurally rather than imported from `src/content`: nothing else
 * in the design system knows what a journey is, and a `TripPhoto` satisfies
 * this without either side importing the other. Everything but `src` is
 * optional, so a strip that only knows a path can still open one.
 */
export type LightboxPhoto = {
  src: string
  alt?: string
  /** Editorial, printed under the photograph. Distinct from `alt`. */
  caption?: string | null
  credit?: string | null
  /** Intrinsic pixels, where known. The viewer letterboxes to them. */
  width?: number | null
  height?: number | null
  /** Where to hold the crop, as `object-position`. Centred when absent. */
  focal?: [x: number, y: number]
}

/** `object-position` for a crop, holding the focal point where there is one. */
export const position = (photo: LightboxPhoto) =>
  photo.focal ? `${photo.focal[0] * 100}% ${photo.focal[1] * 100}%` : '50% 50%'

/** The photograph's own proportions, where they are known. */
export const ratio = (photo: LightboxPhoto) =>
  photo.width && photo.height ? `${photo.width}/${photo.height}` : '4/3'

/* -------------------------------------------------------------------------- */
/*  The viewer                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The dark viewer layer, ready to drop beside any strip of photographs.
 *
 * `index` null is closed — the caller holds it, because the thing that opens
 * the viewer is always a tile that knows which photograph it is.
 */
export function PhotoLightbox({
  photos,
  index,
  onIndex,
  onClose,
  label,
}: {
  photos: LightboxPhoto[]
  /** Which photograph is up; null closes the viewer. */
  index: number | null
  onIndex: (index: number) => void
  onClose: () => void
  /** The dialog's accessible name, e.g. "Photograph viewer, Day 3". */
  label: string
}) {
  return (
    <Layer open={index !== null} onClose={onClose} label={label} tone="dark">
      {index !== null && (
        <Viewer photos={photos} index={index} onIndex={onIndex} onClose={onClose} />
      )}
    </Layer>
  )
}

/* -------------------------------------------------------------------------- */
/*  The dialog                                                                 */
/* -------------------------------------------------------------------------- */

export function Layer({
  open,
  onClose,
  label,
  tone,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  tone: 'light' | 'dark'
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  /* The page behind stops scrolling while a layer is up. `<dialog>` makes it
     inert but not still, and a wheel over the scrim would otherwise move the
     page underneath.

     Each layer saves what it found and puts it back, which is what makes the
     stack work: the viewer opened over the sheet restores `hidden` — the
     sheet's lock — rather than letting the page scroll again behind a sheet
     that is still open. */
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const { overflow } = root.style
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = overflow
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className="lp-lightbox"
      /* Escape is the browser's to handle, and it would close the dialog
         behind React's back — leaving state that says "open" over a dialog
         that is not. Taking it here keeps the two agreeing. */
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100dvh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        padding: 0,
        border: 0,
        overflow: 'hidden',
        background: tone === 'dark' ? 'var(--surface-ground-deep)' : 'var(--surface-page)',
        color: tone === 'dark' ? 'var(--text-on-ground)' : 'var(--text-body)',
      }}
    >
      {children}
    </dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  One photograph at a time                                                   */
/* -------------------------------------------------------------------------- */

/** How far a finger has to travel sideways before it counts as a swipe. */
const SWIPE_PX = 48

function Viewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: LightboxPhoto[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const count = photos.length
  const photo = photos[index]!

  const go = useCallback(
    (step: number) => onIndex((index + step + count) % count),
    [index, count, onIndex],
  )

  /* The keys belong to the dialog, not the document: the viewer is the only
     thing listening while it is open, and nothing is left listening after. */
  useEffect(() => {
    const dialog = rootRef.current?.closest('dialog')
    if (!dialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        onIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        onIndex(count - 1)
      }
    }
    dialog.addEventListener('keydown', onKey)
    return () => dialog.removeEventListener('keydown', onKey)
  }, [go, onIndex, count])

  /* Keep the current thumbnail in view as the photographs change. */
  useEffect(() => {
    const thumb = railRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    thumb?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [index, reduced])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const from = start.current
    start.current = null
    if (!from || count < 2) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    /* Mostly sideways, and far enough: a slightly diagonal swipe still counts,
       a vertical one — somebody reaching for the caption — does not. */
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1)
  }

  /* What is written under the photograph. The caption where the office wrote
     one; otherwise the description, which is all most photographs have. When
     it is the description it is hidden from screen readers, which have
     already heard it as the image's alt. */
  const words = photo.caption ?? photo.alt ?? null
  const wordsAreAlt = !photo.caption

  const neighbours =
    count > 1 ? [photos[(index + 1) % count]!, photos[(index - 1 + count) % count]!] : []

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--gutter)',
        }}
      >
        <p
          aria-live="polite"
          style={{
            margin: 0,
            fontSize: 'var(--text-label)',
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--text-on-ground-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span className="lp-sr-only">Photograph </span>
          {index + 1} / {count}
        </p>
        <CloseButton onClick={onClose} tone="dark" autoFocus />
      </header>

      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (start.current = null)}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          /* The page's own horizontal pan would otherwise eat the swipe. */
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        <figure style={{ position: 'absolute', inset: '0 var(--gutter)', margin: 0 }}>
          <Image
            key={photo.src + index}
            src={photo.src}
            alt={photo.alt ?? ''}
            fill
            sizes="100vw"
            priority
            draggable={false}
            style={{
              objectFit: 'contain',
              animation: 'veil var(--dur-slow) var(--ease-breath)',
            }}
          />
        </figure>

        {/* The photographs either side, fetched now so the next one is
            already there when it is asked for. */}
        {neighbours.map((next, i) => (
          <Image
            key={`${next.src}-next-${i}`}
            src={next.src}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            loading="eager"
            style={{ objectFit: 'contain', opacity: 0, pointerEvents: 'none' }}
          />
        ))}

        {count > 1 && (
          <>
            <StepButton direction="previous" onClick={() => go(-1)} />
            <StepButton direction="next" onClick={() => go(1)} />
          </>
        )}
      </div>

      <div style={{ padding: 'var(--space-4) var(--gutter) 0', minHeight: 56, textAlign: 'center' }}>
        {words && (
          <p
            aria-hidden={wordsAreAlt || undefined}
            style={{
              margin: '0 auto',
              maxWidth: 'var(--measure)',
              fontSize: 'var(--text-small)',
              lineHeight: 'var(--leading-body)',
              color: 'var(--text-on-ground)',
            }}
          >
            {words}
          </p>
        )}
        {photo.credit && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 'var(--text-label)',
              color: 'var(--text-on-ground-muted)',
            }}
          >
            {photo.credit}
          </p>
        )}
      </div>

      {count > 1 && (
        <div
          ref={railRef}
          role="group"
          aria-label="All photographs"
          className="lp-thumbs"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: 'var(--space-4) var(--gutter) var(--space-5)',
            scrollbarWidth: 'none',
          }}
        >
          {photos.map((thumb, i) => {
            const on = i === index
            return (
              <button
                key={thumb.src + i}
                type="button"
                data-index={i}
                aria-label={`Show photograph ${i + 1} of ${count}`}
                aria-current={on ? 'true' : undefined}
                onClick={() => onIndex(i)}
                style={{
                  position: 'relative',
                  flex: 'none',
                  width: 72,
                  height: 52,
                  padding: 0,
                  border: `1px solid ${on ? 'var(--saffron)' : 'transparent'}`,
                  outline: on ? '1px solid var(--saffron)' : 'none',
                  outlineOffset: 2,
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  background: 'var(--surface-on-ground)',
                  opacity: on ? 1 : 0.55,
                  cursor: 'pointer',
                  transition: 'opacity var(--dur-quick) var(--ease-breath)',
                }}
              >
                <Image
                  src={thumb.src}
                  alt=""
                  fill
                  sizes="80px"
                  style={{ objectFit: 'cover', objectPosition: position(thumb) }}
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Controls                                                                   */
/* -------------------------------------------------------------------------- */

const quietButton = (tone: 'light' | 'dark'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  padding: 0,
  flex: 'none',
  borderRadius: 'var(--radius-pill)',
  border: `1px solid ${tone === 'dark' ? 'var(--border-on-ground)' : 'var(--border-hairline)'}`,
  background: tone === 'dark' ? 'var(--surface-on-ground)' : 'var(--surface-page)',
  color: 'inherit',
  cursor: 'pointer',
})

export function CloseButton({
  onClick,
  tone,
  autoFocus,
}: {
  onClick: () => void
  tone: 'light' | 'dark'
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      autoFocus={autoFocus}
      style={quietButton(tone)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        <path d="M3 3l10 10M13 3L3 13" />
      </svg>
    </button>
  )
}

function StepButton({ direction, onClick }: { direction: 'previous' | 'next'; onClick: () => void }) {
  const next = direction === 'next'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={next ? 'Next photograph' : 'Previous photograph'}
      className="lp-viewer-step"
      style={{
        ...quietButton('dark'),
        position: 'absolute',
        top: '50%',
        [next ? 'right' : 'left']: 'var(--space-4)',
        transform: 'translateY(-50%)',
        width: 52,
        height: 52,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        <path d={next ? 'M7 3l6 6-6 6' : 'M11 3L5 9l6 6'} />
      </svg>
    </button>
  )
}
