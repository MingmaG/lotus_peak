'use client'

import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react'
import type { TripPhoto } from '@/content/types'
import { usePrefersReducedMotion } from '@/motion'

/**
 * A journey's photographs: a mosaic on the page, every photograph in a sheet,
 * and a viewer over both.
 *
 * Three layers, each a native `<dialog>` above the last. `showModal()` is what
 * buys the focus trap, the inert page behind, Escape and the focus restore —
 * the three things `InquiryDrawer` had to write by hand — and it stacks, so
 * Escape in the viewer returns to the sheet it was opened from rather than
 * closing both.
 *
 * Nothing inside a dialog renders until it opens. The page is prerendered,
 * and a viewer holding forty full-width photographs in its closed state would
 * be forty downloads for somebody who never opens it.
 */
export function TripGallery({ photos, title }: { photos: TripPhoto[]; title: string }) {
  const [sheet, setSheet] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)

  const closeSheet = useCallback(() => setSheet(false), [])
  const closeViewer = useCallback(() => setViewing(null), [])

  /* The page behind stops scrolling while either layer is up. `<dialog>`
     makes it inert but not still, and a wheel over the scrim would otherwise
     move the journey underneath. */
  const open = sheet || viewing !== null
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const { overflow } = root.style
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = overflow
    }
  }, [open])

  if (photos.length === 0) return null
  const shown = photos.slice(0, 5)

  return (
    <>
      <div style={{ position: 'relative' }}>
        <div className="lp-mosaic" data-count={shown.length}>
          {shown.map((photo, i) => (
            <button
              key={photo.src + i}
              type="button"
              className="lp-mosaic-tile"
              onClick={() => setViewing(i)}
              aria-label={`Open photograph ${i + 1} of ${photos.length}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt ?? ''}
                fill
                sizes={i === 0 ? '(max-width: 700px) 100vw, 50vw' : '(max-width: 700px) 50vw, 25vw'}
                style={{ objectFit: 'cover', objectPosition: position(photo) }}
              />
            </button>
          ))}
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="lp-gallery-all"
            style={{
              position: 'absolute',
              right: 'var(--space-4)',
              bottom: 'var(--space-4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              background: 'var(--surface-veil)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              fontSize: 'var(--text-label)',
              fontWeight: 500,
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <GridIcon />
            View all {photos.length} photographs
          </button>
        )}
      </div>

      <Layer open={sheet} onClose={closeSheet} label={`Photographs from ${title}`} tone="light">
        {sheet && <Sheet photos={photos} title={title} onClose={closeSheet} onOpen={setViewing} />}
      </Layer>

      <Layer
        open={viewing !== null}
        onClose={closeViewer}
        label={`Photograph viewer, ${title}`}
        tone="dark"
      >
        {viewing !== null && (
          <Viewer photos={photos} index={viewing} onIndex={setViewing} onClose={closeViewer} />
        )}
      </Layer>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  The dialog                                                                 */
/* -------------------------------------------------------------------------- */

function Layer({
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
/*  Every photograph                                                           */
/* -------------------------------------------------------------------------- */

function Sheet({
  photos,
  title,
  onClose,
  onOpen,
}: {
  photos: TripPhoto[]
  title: string
  onClose: () => void
  onOpen: (index: number) => void
}) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-5)',
          padding: 'var(--space-4) var(--gutter)',
          background: 'var(--surface-page)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-label)',
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {photos.length} photographs
          </p>
          <h2
            style={{
              margin: '4px 0 0',
              fontSize: 'var(--text-h3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h2>
        </div>
        <CloseButton onClick={onClose} tone="light" autoFocus />
      </header>

      <div
        className="lp-gallery"
        style={{
          maxWidth: 'var(--container)',
          margin: '0 auto',
          padding: 'var(--space-7) var(--gutter) var(--space-9)',
        }}
      >
        {photos.map((photo, i) => (
          <figure key={photo.src + i} style={{ margin: '0 0 var(--space-6)', breakInside: 'avoid' }}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Open photograph ${i + 1} of ${photos.length}`}
              className="lp-mosaic-tile"
              style={{ aspectRatio: ratio(photo), width: '100%' }}
            >
              <Image
                src={photo.src}
                alt={photo.alt ?? ''}
                fill
                sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                style={{ objectFit: 'cover', objectPosition: position(photo) }}
              />
            </button>
            {photo.caption && (
              <figcaption
                style={{ marginTop: 10, fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}
              >
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
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
  photos: TripPhoto[]
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
    thumb?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' })
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

  const neighbours = count > 1 ? [photos[(index + 1) % count]!, photos[(index - 1 + count) % count]!] : []

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
          <p style={{ margin: '6px 0 0', fontSize: 'var(--text-label)', color: 'var(--text-on-ground-muted)' }}>
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

function CloseButton({
  onClick,
  tone,
  autoFocus,
}: {
  onClick: () => void
  tone: 'light' | 'dark'
  autoFocus?: boolean
}) {
  return (
    <button type="button" onClick={onClick} aria-label="Close" autoFocus={autoFocus} style={quietButton(tone)}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.25">
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
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.25">
        <path d={next ? 'M7 3l6 6-6 6' : 'M11 3L5 9l6 6'} />
      </svg>
    </button>
  )
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.1">
      <rect x="1" y="1" width="5" height="5" />
      <rect x="8" y="1" width="5" height="5" />
      <rect x="1" y="8" width="5" height="5" />
      <rect x="8" y="8" width="5" height="5" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */

const position = (photo: TripPhoto) => `${photo.focal[0] * 100}% ${photo.focal[1] * 100}%`

/** The photograph's own proportions in the sheet, where they are known. */
const ratio = (photo: TripPhoto) => (photo.width && photo.height ? `${photo.width}/${photo.height}` : '4/3')
