'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { asset } from '@/lib/assets'
import { useDocumentProgress, usePrefersReducedMotion } from './hooks'

/**
 * The Four Dignities as one page-wide ground, and the rail that lets a reader
 * ask what they are.
 *
 * As the reader scrolls, the same watermark turns through the circle:
 * tiger (awareness) → snow lion (joy and love) → garuda (wisdom) →
 * dragon (compassion). Fixed behind every page, breathing with the imagery;
 * coloured art is desaturated and lifted so only the line survives on paper.
 *
 * Naming it in the bottom-right corner, on every route and at every scroll
 * position, is the rail: the current dignity in English and Dzongkha over four
 * markers. The word is a button — clicking "Compassion" opens the dragon's
 * plate, "Awareness" the tiger's — and the plate is the art at full size beside
 * what the symbol means. The watermark alone told the reader there was
 * something there; the word is what lets them find out what.
 *
 * Rendered exactly once, in the site layout. The index comes from the scroll
 * broker's measured document height, which recomputes on load and whenever the
 * body resizes — not from the prototype's 700ms timer (audit B7).
 */

const DESC = {
  tiger:
    "The tiger's whole nature is watchfulness — each paw placed with care. This is mindfulness and " +
    'vigilant awareness: the mind noticing itself, present with what is actually happening rather than ' +
    'lost in distraction. In Buddhist terms, this is the root all the others grow from — without ' +
    'awareness, love has no eyes to see who needs it, wisdom has nothing to reflect on.',
  lion:
    "Once awareness is steady, what arises naturally is delight — the snow lion's playful leap across " +
    "the mountain. This joy is not separate from love; in this tradition, genuine love is the wish for " +
    "others to feel that same lightness and happiness. The snow lion's fearless cheerfulness is basic " +
    'goodness recognising itself and wanting to share that recognition — love begins as joy that ' +
    'overflows towards others.',
  garuda:
    'The garuda is born fully formed, flying instantly — it does not need to slowly work things out ' +
    'below. This is wisdom that sees clearly and directly, beyond the back-and-forth of hope and fear, ' +
    'beyond concepts. It is the same awareness from the tiger, now matured into full clarity — seeing ' +
    'interdependence, seeing that nothing exists on its own, seeing through confusion.',
  dragon:
    'The dragon is where all three come together and turn outwards. Its thundering voice is not for its ' +
    'own sake — it is wisdom and joyful love now acting fearlessly in the world, on behalf of others. ' +
    'This is compassion in its fullest form: not passive sympathy, but wisdom and love given a voice, ' +
    'unafraid to speak or act for the benefit of beings.',
}

const CIRCLE =
  'The full circle: awareness (tiger) becomes joyful love (snow lion), which matures into wisdom ' +
  '(garuda), which naturally expresses as compassion (dragon) — and compassion in action deepens ' +
  'awareness again. It is the same basic goodness, moving in a circle rather than a straight line.'

type Dignity = {
  src: string
  /** The animal. Named in the plate's heading and in the rail's accessible name. */
  name: string
  /** What the animal stands for. */
  en: string
  dz: string
  body: string
  /** Real `alt` for the plate, where the art is the content rather than a ground. */
  alt: string
  /** The watermark treatment: desaturated and lifted until only the line is left. */
  filter: string
  side: 'left' | 'right'
  w: string
  width: number
  height: number
}

const DIGNITIES: Dignity[] = [
  {
    src: asset('illustrations/dignity-tiger.png'),
    name: 'Tiger',
    en: 'Awareness',
    dz: 'དྲན་པ་དང་ཤེས་བཞིན།',
    body: DESC.tiger,
    alt: 'A tiger painted in black and rust on a gold ground, head lowered and tail curled',
    filter: 'grayscale(1) brightness(1.55) contrast(1.6)',
    side: 'right',
    w: '56vw',
    width: 760,
    height: 731,
  },
  {
    src: asset('illustrations/dignity-snow-lion.png'),
    name: 'Snow lion',
    en: 'Joy and love',
    dz: 'དགའ་བ་དང་བདེ་བ།',
    body: DESC.lion,
    alt: 'A snow lion drawn in black line, mid-leap, its mane and tail worked into tight curls',
    filter: 'grayscale(1) contrast(1.1)',
    side: 'left',
    w: '50vw',
    width: 736,
    height: 549,
  },
  {
    src: asset('illustrations/dignity-garuda.png'),
    name: 'Garuda',
    en: 'Wisdom',
    dz: 'ཤེས་རབ་དང་ཡེ་ཤེས།',
    body: DESC.garuda,
    alt: 'A garuda drawn in black line, wings spread, a snake held in its beak and claws among stylised clouds',
    filter: 'grayscale(1) brightness(1.08) contrast(1.15)',
    side: 'right',
    w: '54vw',
    width: 700,
    height: 700,
  },
  {
    src: asset('illustrations/dignity-dragon.jpg'),
    name: 'Dragon',
    en: 'Compassion',
    dz: 'སྙིང་རྗེ།',
    body: DESC.dragon,
    alt: 'A druk in green and gold among white clouds, a jewel held in each claw',
    filter: 'grayscale(1) brightness(1.12) contrast(1.35)',
    side: 'left',
    w: '58vw',
    width: 600,
    height: 450,
  },
]

const MASK = 'radial-gradient(ellipse 50% 50% at 50% 50%,#000 40%,transparent 92%)'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Dignities() {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const reduced = usePrefersReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)

  const ref = useDocumentProgress((p) => {
    setIndex(Math.floor(p * 4))
    // Written straight to the node rather than held in state. The broker calls
    // this on every frame of every scroll; a setState here would re-render the
    // rail — and an open plate — sixty times a second for a transform that
    // React has no other reason to know about.
    const el = wrap.current
    if (el) el.style.transform = reduced ? '' : `translate3d(0,${(-p * 140).toFixed(1)}px,0)`
  })

  const active = Math.max(0, Math.min(DIGNITIES.length - 1, index))
  const close = useCallback(() => setOpen(null), [])

  return (
    <>
      <div
        ref={ref}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}
      >
        <div style={{ position: 'absolute', inset: '-10% 0', willChange: 'transform' }} ref={wrap}>
          {DIGNITIES.map((g, k) => {
            const on = k === active
            return (
              <div
                key={g.src}
                style={{
                  position: 'absolute',
                  top: '50%',
                  [g.side]: '-6%',
                  width: g.w,
                  maxWidth: 900,
                  opacity: on ? 1 : 0,
                  transform: on
                    ? 'translate(0,-50%)'
                    : `translate(${g.side === 'right' ? '9%' : '-9%'},-44%)`,
                  transition: on
                    ? 'opacity 2.6s var(--ease-inhale), transform 3.2s var(--ease-settle)'
                    : 'opacity 1.4s var(--ease-inhale), transform 0s 1.4s',
                }}
              >
                <div style={{ animation: 'breathe var(--dur-breath) var(--ease-inhale) infinite' }}>
                  <Image
                    src={g.src}
                    alt=""
                    width={g.width}
                    height={g.height}
                    sizes={g.w}
                    // Always lazy, never `priority`. The layer is fixed, so the
                    // first guardian is in the viewport at load and is fetched
                    // straight away regardless; marking it eager only buys it a
                    // preload that would compete with the hero for the LCP.
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: 'auto',
                      filter: g.filter,
                      mixBlendMode: 'multiply',
                      opacity: 0.09,
                      maskImage: MASK,
                      WebkitMaskImage: MASK,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <DignityRail active={active} onOpen={setOpen} />

      {open !== null && <DignityPlate index={open} onClosed={close} />}
    </>
  )
}

/* ---------------------------------------------------------------------------
   The rail
   --------------------------------------------------------------------------- */

/**
 * The bottom-right corner: the current dignity in English and Dzongkha over
 * four markers, the active one gold.
 *
 * The word is the control. Clicking "Compassion" opens the dragon's plate,
 * clicking "Awareness" the tiger's — whichever the scroll has reached. The
 * markers are an indicator and stay out of the tab order; four adjacent
 * controls for one destination is noise a screen reader has to read through,
 * and the word already says where it goes.
 *
 * It carries a gold hairline at rest rather than only colouring on hover,
 * because a bare line of tracked caps in the corner of a page gives a reader
 * no reason to try it.
 */
function DignityRail({ active, onOpen }: { active: number; onOpen: (index: number) => void }) {
  const [hover, setHover] = useState(false)
  const current = DIGNITIES[active]!

  return (
    <div
      className="lp-dignity-rail"
      style={{
        position: 'fixed',
        right: 'var(--space-5)',
        bottom: 'var(--space-9)',
        // Above the page (`#main` is 1) and below the nav (50), so the mobile
        // menu — a full-height panel inside the nav's own stacking context —
        // covers the rail rather than having it float over the menu's links.
        // The design project puts this at 160 to clear the Halo; the Halo is a
        // 7% white bloom over the whole frame, and letting it wash over a line
        // of caps costs nothing next to that collision.
        zIndex: 40,
        display: 'grid',
        justifyItems: 'end',
        gap: 6,
        textAlign: 'right',
        // A plate, not a text-shadow. The design project lifts the caption off
        // the page with a white glow, which works over the pale grounds it was
        // drawn on and fails completely in the corner of a full-bleed hero,
        // where the protection gradient is at its darkest and ink caps simply
        // vanish. This is the treatment the nav already uses when it has to
        // stand over a photograph, and it holds on every ground the site has.
        background: 'var(--surface-veil)',
        backdropFilter: 'var(--blur-nav)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-sm)',
        color: hover ? 'var(--gold)' : 'var(--ink)',
        transition: 'color var(--dur-quick) var(--ease-inhale)',
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(active)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={`${current.name} — ${current.en}. Read what this dignity means.`}
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          display: 'grid',
          justifyItems: 'end',
          gap: 6,
          textAlign: 'right',
        }}
      >
        <span
          key={current.en}
          style={{
            fontSize: 'var(--text-micro)',
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            borderBottom: 'var(--gold-rule)',
            paddingBottom: 4,
            animation: 'driftIn var(--dur-drift) var(--ease-inhale) both',
          }}
        >
          {current.en}
        </span>
        <span
          key={current.dz}
          lang="dz"
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            animation: 'driftIn var(--dur-drift) var(--ease-inhale) var(--delay-drift) both',
          }}
        >
          {current.dz}
        </span>
      </button>

      <span aria-hidden="true" style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {DIGNITIES.map((g, k) => (
          <span
            key={g.name}
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: k === active ? 'var(--gold)' : 'currentColor',
              opacity: k === active ? 1 : 0.35,
              transition: 'all var(--dur-turn) var(--ease-inhale)',
            }}
          />
        ))}
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   The plate
   --------------------------------------------------------------------------- */

/** A CSS time token, in milliseconds. */
function cssMs(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (value.endsWith('ms')) return Number.parseFloat(value) || 0
  if (value.endsWith('s')) return (Number.parseFloat(value) || 0) * 1000
  return 0
}

/**
 * How long the exit takes, read back from the tokens that drive it: the panel
 * leaves over `--dur-rise`, while the scrim waits `--delay-veil-out` and then
 * fades over `--dur-veil`, so the two settle together.
 *
 * Reading the tokens rather than restating them means the unmount cannot drift
 * out of step with the CSS — and under reduced motion, where every duration
 * token is `0s`, this comes back `0` and the plate closes with no timer at all.
 */
function exitMs(): number {
  return Math.max(cssMs('--dur-rise'), cssMs('--delay-veil-out') + cssMs('--dur-veil'))
}

/**
 * One dignity, at length: the art at full size beside what the symbol means,
 * and under it the circle the four of them make together.
 *
 * It leaves as slowly as it arrives. The design project's version has
 * `role="dialog"` and Escape; the focus trap, the focus restore and the body
 * scroll lock are this port's, matching `InquiryDrawer`.
 */
function DignityPlate({ index, onClosed }: { index: number; onClosed: () => void }) {
  const d = DIGNITIES[index]!
  const [closing, setClosing] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const exit = useRef(0)

  const close = useCallback(() => {
    if (exit.current) return
    const ms = exitMs()
    if (ms <= 0) {
      onClosed()
      return
    }
    setClosing(true)
    exit.current = window.setTimeout(() => {
      exit.current = 0
      onClosed()
    }, ms)
  }, [onClosed])

  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const node = panel.current
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      clearTimeout(exit.current)
      restoreTo?.focus()
    }
  }, [close])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${d.name}: ${d.en}`}
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'var(--scrim)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--gutter)',
        // The scrim stops taking clicks the moment it starts to leave, so a
        // second click during the exit cannot reopen or re-close anything.
        pointerEvents: closing ? 'none' : 'auto',
        animation: closing
          ? 'veilOut var(--dur-veil) var(--ease-inhale) var(--delay-veil-out) both'
          : 'veil var(--dur-veil) var(--ease-inhale) both',
      }}
    >
      <div
        ref={panel}
        className="lp-dignity-plate"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-page)',
          width: '100%',
          maxWidth: 920,
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,5fr) minmax(0,6fr)',
          // The art panel runs the full height of the plate rather than
          // stopping at the drawing's own square, which left a bare white
          // shelf under it whenever the prose ran longer.
          alignItems: 'stretch',
          boxShadow: 'var(--shadow-dialog)',
          animation: closing
            ? 'riseOut var(--dur-rise) var(--ease-settle) both'
            : 'riseIn var(--dur-rise) var(--ease-settle) var(--delay-rise) both',
        }}
      >
        <div
          style={{
            background: 'var(--surface-sunken)',
            display: 'grid',
            placeItems: 'center',
            padding: 'var(--space-5)',
            minHeight: 0,
          }}
        >
          <Image
            src={d.src}
            alt={d.alt}
            width={d.width}
            height={d.height}
            sizes="(max-width: 760px) 92vw, 420px"
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div
          style={{
            padding: 'var(--space-7)',
            display: 'grid',
            alignContent: 'start',
            gap: 'var(--space-5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
              gap: 'var(--space-4)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-micro)',
                letterSpacing: 'var(--tracking-label)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                paddingTop: 10,
              }}
            >
              The Four Dignities · {index + 1} of 4
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              style={{
                flex: 'none',
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'var(--hairline)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 'var(--text-h2)',
              lineHeight: 'var(--leading-heading)',
              fontWeight: 'var(--weight-body)',
            }}
          >
            {d.name}{' '}
            <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
              →
            </span>{' '}
            {d.en}
          </h2>

          <p
            lang="dz"
            style={{
              fontSize: 'var(--text-small)',
              lineHeight: 1.7,
              color: 'var(--text-muted)',
            }}
          >
            {d.dz}
          </p>

          <p style={{ lineHeight: 'var(--leading-body)' }}>{d.body}</p>

          <p
            style={{
              paddingTop: 'var(--space-4)',
              borderTop: 'var(--hairline)',
              fontSize: 'var(--text-small)',
              lineHeight: 'var(--leading-body)',
              color: 'var(--text-muted)',
            }}
          >
            {CIRCLE}
          </p>
        </div>
      </div>
    </div>
  )
}
