'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { SiteIcon, type SiteIconName } from '../core/SiteIcon'
import { asset } from '@/lib/assets'
/* The deep path, not the `@/motion` barrel: the barrel re-exports `Split`,
   which imports from `@/design-system`, and design-system importing that would
   close a cycle. `hooks` itself only reaches the scroll broker. */
import { usePrefersReducedMotion } from '@/motion/hooks'

/** One dzongkhag outline, as drawn in `public/assets/bhutan-districts.json`. */
type District = { id: string; name: string; d: string }

/** A district with its west-to-east entrance delay worked out once. */
type DrawnDistrict = District & { delay: string }

type Place = {
  /** The dzongkhag the place stands in, so hovering either lights both. */
  id: string
  name: string
  /** A site icon, or the one drawn shape that is not a building. */
  icon: SiteIconName | 'mountain'
  sights: string[]
  /** The point on the map, in viewBox units. */
  cx: number
  cy: number
  /** Where the label hangs, in viewBox units. */
  ax: number
  ay: number
  /** How the leader line bends: horizontal, vertical, or below the point. */
  side: 'h' | 'v' | 'b'
}

/* The viewBox the outlines are drawn in. The place coordinates below are in
   the same units, which is why they look like they start off the left edge. */
const VB = { x: -200, y: -170, w: 1192, h: 700 }
const VIEW_BOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`

/**
 * The eleven places, with the icons the Home page's destinations already use —
 * Paro is Taktsang, Thimphu the Buddha, Punakha the dzong's long wall, Bumthang
 * Jakar, Trongsa a chorten. Lhuentse has no building silhouette in the set and
 * is drawn as a peak instead.
 *
 * Positions are the design's, and they are hand-placed rather than derived:
 * the labels are arranged so no leader line crosses another at the resting
 * tilt.
 */
const PLACES: Place[] = [
  { id: 'BT-15', name: 'Thimphu', icon: 'buddha', sights: ['Buddha Dordenma', 'Tashichho Dzong'], cx: 184, cy: 176, ax: -60, ay: 40, side: 'h' },
  { id: 'BT-11', name: 'Paro', icon: 'taktsang', sights: ['Tiger’s Nest', 'Rinpung Dzong'], cx: 140, cy: 200, ax: -130, ay: 250, side: 'h' },
  { id: 'BT-12', name: 'Phuentsholing', icon: 'pavilion', sights: ['Bhutan Gate'], cx: 178, cy: 390, ax: 130, ay: 450, side: 'b' },
  { id: 'BT-23', name: 'Punakha', icon: 'punakha', sights: ['Punakha Dzong'], cx: 259, cy: 165, ax: 230, ay: -80, side: 'v' },
  { id: 'BT-GA', name: 'Gasa', icon: 'dzong', sights: ['Gasa Dzong', 'Hot springs'], cx: 271, cy: 80, ax: 450, ay: -90, side: 'v' },
  { id: 'BT-33', name: 'Bumthang', icon: 'jakar', sights: ['Jakar Dzong'], cx: 465, cy: 150, ax: 680, ay: -60, side: 'v' },
  { id: 'BT-44', name: 'Lhuentse', icon: 'mountain', sights: ['Lhuntse Dzong'], cx: 553, cy: 125, ax: 900, ay: 110, side: 'h' },
  { id: 'BT-41', name: 'Trashigang', icon: 'dzong', sights: ['Trashigang Dzong'], cx: 700, cy: 262, ax: 940, ay: 300, side: 'h' },
  { id: 'BT-43', name: 'Pemagatshel', icon: 'stupa', sights: ['Yalang Ney'], cx: 600, cy: 332, ax: 850, ay: 450, side: 'b' },
  { id: 'BT-42', name: 'Mongar', icon: 'pavilion', sights: ['Mongar Dzong'], cx: 584, cy: 262, ax: 630, ay: 450, side: 'b' },
  { id: 'BT-32', name: 'Trongsa', icon: 'chorten', sights: ['Trongsa Dzong'], cx: 411, cy: 222, ax: 400, ay: 450, side: 'b' },
]

/**
 * Below this container width the eleven labels overlap each other and the map
 * they point at, so the map keeps its districts and drops its places. The
 * tooltip still names whatever is under the finger.
 */
const PINS_MIN_WIDTH = 520

/** How far a pointer may travel before a press counts as a turn, not a click. */
const DRAG_SLOP = 4

/**
 * The outlines, once per browser.
 *
 * This is the module-scope memoisation `apps/web/CLAUDE.md` warns about, and it
 * is safe for the one reason the warning does not cover: it lives in a client
 * component, so the closure belongs to one visitor's tab rather than to a
 * server handling every request, and what it holds is a shape file that ships
 * with the build rather than anything the office can publish. Nothing the
 * office edits is cached here.
 */
let cache: DrawnDistrict[] | null = null

/** Only the first `m x,y` is needed: it is the outline's westmost extent. */
function entranceDelay(d: string): string {
  const m = /m\s*([\d.]+),([\d.]+)/.exec(d)
  const x = m ? Number(m[1]) : 400
  return `${(0.1 + (x / 792) * 1.2).toFixed(2)}s`
}

/** A name with its case and accents taken off, for matching the map to the office's destinations. */
function plain(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()
}

/** The JSON is ours, not the API's, so this guards a bad build rather than a bad payload. */
function isDistrict(v: unknown): v is District {
  const d = v as District
  return !!d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.d === 'string'
}

export type MenuMapProps = {
  /** Resting tilt in degrees. */
  tilt?: number
  /** Extrusion layers, 0–16. */
  depth?: number
  /** Tilt to settle into after `settleAfter`. */
  settleTilt?: number
  /** Extrusion layers after settling. */
  settleDepth?: number
  /** Delay before settling, in ms; `null` holds the opening pose. */
  settleAfter?: number | null
  /** Slow rotational drift while idle. */
  drift?: boolean
  /** Show the eleven labelled places. */
  pins?: boolean
  /**
   * The site's own destinations. A place or district whose name matches one
   * leads to its page; the rest fall through to `onSelect` without an `href`.
   */
  destinations?: { name: string; path: string }[]
  /** The page being read. The place whose destination it is — or is inside — stays lit. */
  current?: string
  /** Fired when a district or a place is chosen — not when one is dragged. */
  onSelect?: (place: { id: string; name: string; href?: string }) => void
  style?: CSSProperties
}

/**
 * An interactive map of Bhutan by dzongkhag, for the menu panel.
 *
 * Each district is drawn once per extrusion layer and pushed back along z, so
 * the country stands up off the page as a stack rather than as a shadow. It
 * opens at 38° over eight layers and eases to 55° over ten, which is the pose
 * the labels were placed for; it drifts a degree and a half either side while
 * nothing is under the pointer, and it can be dragged round and let go, when it
 * settles back to where it started.
 *
 * The map is an affordance, not the only way through: every district leads to
 * the journeys index, which the menu also lists and the panel's button repeats.
 * That is why the outlines themselves are not in the tab order — eleven more
 * stops before the CTA, all arriving at one page — while the labelled places,
 * which name somewhere, are buttons.
 */
export function MenuMap({
  tilt = 38,
  depth = 8,
  settleTilt = 55,
  settleDepth = 10,
  settleAfter = 3000,
  drift = true,
  pins = true,
  destinations = [],
  current,
  onSelect,
  style,
}: MenuMapProps) {
  const reduced = usePrefersReducedMotion()

  const [districts, setDistricts] = useState<DrawnDistrict[]>(cache ?? [])
  const [active, setActive] = useState<string | null>(null)
  const [rot, setRot] = useState<{ rx: number | null; rz: number }>({ rx: null, rz: -6 })
  const [drag, setDrag] = useState<{ x: number; y: number; rx: number; rz: number } | null>(null)
  const [tip, setTip] = useState({ x: 0, y: 0 })
  const [settled, setSettled] = useState(false)
  const [width, setWidth] = useState(0)

  const frame = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  /* A press that turned the map must not also follow it. Read in the click
     handler, which runs after the pointer is already up. */
  const turned = useRef(false)

  useEffect(() => {
    if (cache) return
    let live = true
    fetch(asset('bhutan-districts.json'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: unknown) => {
        if (!Array.isArray(list)) return
        cache = list.filter(isDistrict).map((d) => ({ ...d, delay: entranceDelay(d.d) }))
        if (live) setDistricts(cache)
      })
      /* A map that does not arrive leaves the menu's links exactly as they
         were. It is never the reason a visitor cannot navigate. */
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  // Its own width decides whether the labels fit, whatever it is laid out in.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const write = () => setWidth(el.getBoundingClientRect().width)
    write()
    const ro = new ResizeObserver(write)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* The opening pose and the ease into the resting one are an entrance, so
     reduced motion opens in the resting pose instead of jumping to it later. */
  useEffect(() => {
    if (settleAfter == null) return
    if (reduced) {
      setSettled(true)
      return
    }
    const t = setTimeout(() => setSettled(true), settleAfter)
    return () => clearTimeout(t)
  }, [settleAfter, reduced])

  const baseTilt = settled ? settleTilt : tilt
  const baseDepth = settled ? settleDepth : depth
  const rx = rot.rx ?? baseTilt
  const rz = rot.rz
  const showPins = pins && width >= PINS_MIN_WIDTH

  const count = Math.max(0, Math.min(16, baseDepth))
  const layers = Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0
    return {
      z: -((i + 1) * 1.6),
      /* The design interpolates two sRGB values by hand; `color-mix` is the
         same arithmetic with the tokens left as tokens. */
      fill: `color-mix(in srgb, var(--sky-deep) ${(t * 100).toFixed(2)}%, var(--sky-mid))`,
    }
  })

  const activeDistrict = districts.find((d) => d.id === active)

  /* The map's names are the country's and the destinations' are the office's,
     so they are matched by name, loosely: case and accents aside, "Könchogsum"
     is "Konchogsum". A labelled place is tried by its label first — Mongar's
     district is spelt "Monggar" in the outlines — then by its district. */
  const pathByName = new Map(destinations.map((d) => [plain(d.name), d.path]))
  const hrefFor = (id: string): string | undefined => {
    for (const name of [PLACES.find((p) => p.id === id)?.name, districts.find((d) => d.id === id)?.name]) {
      const path = name ? pathByName.get(plain(name)) : undefined
      if (path) return path
    }
    return undefined
  }
  const here = current
    ? [...PLACES.map((p) => p.id), ...districts.map((d) => d.id)].find((id) => {
        const path = hrefFor(id)
        return !!path && (current === path || current.startsWith(`${path}/`))
      })
    : undefined
  const lit = (id: string) => active === id || here === id

  const hover = useCallback(
    (id: string) => {
      if (drag || id === active) return
      setActive(id)
      if (pointer.current) setTip(pointer.current)
    },
    [drag, active],
  )
  const leave = useCallback(() => setActive(null), [])

  const choose = (place: { id: string; name: string }) => {
    if (turned.current) return
    onSelect?.({ ...place, href: hrefFor(place.id) })
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    turned.current = false
    /* A finger has no position until it lands, and the synthesised mouseover
       that follows is what raises the tooltip — without this it would be
       raised at the corner of the map. */
    const r = e.currentTarget.getBoundingClientRect()
    pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    setDrag({ x: e.clientX, y: e.clientY, rx, rz })
  }

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    /* The pointer is captured only once the press has become a turn. Captured
       on the way down, the click that follows a plain press is dispatched to
       this frame instead of to the place or district under it, and choosing
       one on the map never did anything. */
    if (!turned.current && (Math.abs(dx) > DRAG_SLOP || Math.abs(dy) > DRAG_SLOP)) {
      turned.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    /* Subtracted, not added: a positive rotateZ is clockwise, which carries the
       near half of the tilted country — the half a visitor is looking at —
       the opposite way to the pointer. Dragging left must turn the map left. */
    setRot({ rz: drag.rz - dx * 0.25, rx: Math.max(10, Math.min(75, drag.rx - dy * 0.25)) })
  }

  /* Letting go returns it to the resting pose — rx null hands the tilt back to
     whichever of the two poses is current. */
  const release = () => {
    if (!drag) return
    setDrag(null)
    setRot({ rx: null, rz: -6 })
  }

  const onLeave = () => {
    release()
    if (active) setActive(null)
  }

  const fade = (delay: string): CSSProperties => ({
    animation: 'lp-map-fade var(--dur-reveal) var(--ease-settle) both',
    /* A delay outlives a zeroed duration, so reduced motion would hold the
       country blank for the length of the stagger. */
    animationDelay: reduced ? '0s' : delay,
  })

  const plane: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }
  const at = (x: number, y: number): CSSProperties => ({
    left: `${((x - VB.x) / VB.w) * 100}%`,
    top: `${((y - VB.y) / VB.h) * 100}%`,
  })

  return (
    <div
      ref={frame}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={onLeave}
      style={{
        position: 'relative',
        aspectRatio: '1192/700',
        perspective: 1800,
        perspectiveOrigin: '50% 30%',
        containerType: 'inline-size',
        cursor: drag ? 'grabbing' : 'grab',
        /* Not `none`: on a phone the map covers most of the open menu, and a
           menu you cannot scroll past is worse than one you cannot tilt.
           Sideways drags still turn it; upward ones scroll the panel. */
        touchAction: 'pan-y',
        userSelect: 'none',
        isolation: 'isolate',
        ...style,
      }}
    >
      {activeDistrict && (
        <div
          style={{
            position: 'absolute',
            left: tip.x,
            top: tip.y,
            /* Flipped to the other side of the pointer near the right edge,
               where a tooltip 16px to the right would leave the map. */
            transform:
              tip.x > width * 0.6
                ? 'translate(-100%, -100%) translate(-16px, -12px)'
                : 'translate(16px, -100%) translateY(-12px)',
            zIndex: 5,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '10px 14px',
            background: 'var(--surface-veil)',
            backdropFilter: 'var(--blur-nav)',
            border: '1px solid var(--gold)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-soft)',
            animation: 'lp-map-fade var(--dur-quick) var(--ease-breath) both',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-micro)',
              fontWeight: 500,
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--text-accent)',
              whiteSpace: 'nowrap',
            }}
          >
            Dzongkhag
          </span>
          <span style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {activeDistrict.name}
          </span>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rx}deg) rotateZ(${rz}deg)`,
          transition: drag
            ? 'none'
            : rot.rx == null
              ? 'transform var(--dur-map-settle) var(--ease-settle)'
              : 'transform var(--dur-slow) var(--ease-settle)',
          willChange: 'transform',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            animation: drift && !drag && !reduced ? 'lp-map-drift var(--dur-mist) var(--ease-inhale) infinite' : 'none',
            animationPlayState: active ? 'paused' : 'running',
          }}
        >
          {/* What the stack casts on the paper. */}
          <svg
            viewBox={VIEW_BOX}
            aria-hidden="true"
            style={{ ...plane, transform: 'translate3d(16px,30px,-48px)', filter: 'blur(16px)', opacity: 0.22 }}
          >
            {districts.map((d) => (
              <path key={d.id} d={d.d} fill="var(--sky-ink)" />
            ))}
          </svg>

          {/* The extrusion: the same country, restated deeper and darker. */}
          {layers.map((l, i) => (
            <svg key={i} viewBox={VIEW_BOX} aria-hidden="true" style={{ ...plane, transform: `translateZ(${l.z}px)` }}>
              {districts.map((d) => (
                <path
                  key={d.id}
                  d={d.d}
                  /* The attribute is the fallback and the style is the ramp: a
                     browser without `color-mix` drops the declaration and keeps
                     the presentation attribute, so the stack goes flat rather
                     than black, which is what an invalid `fill` would give. */
                  fill="var(--sky-mid)"
                  stroke="var(--sky-mid)"
                  strokeWidth=".6"
                  /* The layers the settle adds arrive with the settle, not with
                     the original west-to-east sweep, which is long over. */
                  style={{ fill: l.fill, stroke: l.fill, ...fade(settled && i >= depth ? '0s' : d.delay) }}
                />
              ))}
            </svg>
          ))}

          {/* The face, which is the part that answers to a pointer. */}
          <svg
            viewBox={VIEW_BOX}
            role="img"
            aria-label="Map of Bhutan by dzongkhag"
            onMouseOver={(e) => {
              const id = (e.target as SVGElement).getAttribute?.('data-id')
              if (id) hover(id)
            }}
            onMouseLeave={leave}
            style={plane}
          >
            {districts.map((d, i) => (
              <path
                key={d.id}
                d={d.d}
                data-id={d.id}
                fill={lit(d.id) ? 'var(--sky-deep)' : i % 2 ? 'var(--sky-tint)' : 'var(--sky)'}
                stroke="var(--white)"
                strokeWidth={lit(d.id) ? 1.4 : 1}
                strokeLinejoin="round"
                onClick={() => choose(d)}
                style={{ transition: 'fill var(--dur-quick) var(--ease-breath)', ...fade(d.delay) }}
              />
            ))}

            {showPins &&
              PLACES.map((p, i) => {
                const bend: [number, number] =
                  p.side === 'h' ? [p.cx, p.ay] : p.side === 'b' ? [p.ax, p.cy] : [p.cx, p.ay + (p.cy - p.ay) * 0.4]
                return (
                  <g key={p.id} pointerEvents="none" style={fade(`${(1.4 + i * 0.09).toFixed(2)}s`)}>
                    <path
                      d={`M ${p.cx} ${p.cy} Q ${bend[0]} ${bend[1]} ${p.ax} ${p.ay}`}
                      fill="none"
                      stroke="var(--maroon)"
                      strokeWidth="1.3"
                      strokeDasharray="5 5"
                      strokeLinecap="round"
                    />
                    <circle cx={p.cx} cy={p.cy} r="4" fill="var(--white)" stroke="var(--maroon)" strokeWidth="1.5" />
                    <circle cx={p.ax} cy={p.ay} r="3" fill="var(--maroon)" />
                  </g>
                )
              })}
          </svg>

          {/* The labels stand on the map but face the reader: each one is
              counter-rotated by exactly what the map is turned by. */}
          {showPins && (
            <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', pointerEvents: 'none' }}>
              {PLACES.map((p, i) => {
                const hang = p.side === 'b'
                return (
                  <div key={p.id} style={{ position: 'absolute', ...at(p.ax, p.ay), width: 0, height: 0, transformStyle: 'preserve-3d', zIndex: 2 }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        width: 0,
                        height: 0,
                        transformOrigin: '50% 100%',
                        transform: `rotateZ(${-rz}deg) rotateX(${-rx}deg)`,
                        ...fade(`${(1.4 + i * 0.09).toFixed(2)}s`),
                      }}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => hover(p.id)}
                        onMouseLeave={leave}
                        onClick={() => choose({ id: p.id, name: p.name })}
                        aria-current={here === p.id ? 'page' : undefined}
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: hang ? 'auto' : 8,
                          top: hang ? 8 : 'auto',
                          transform: 'translateX(-50%) translateZ(1px)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          margin: 0,
                          padding: 0,
                          border: 0,
                          background: 'transparent',
                          font: 'inherit',
                          width: 'max-content',
                          maxWidth: 'clamp(110px,18cqw,200px)',
                          textAlign: 'center',
                          pointerEvents: 'auto',
                          cursor: 'pointer',
                          backfaceVisibility: 'hidden',
                          WebkitFontSmoothing: 'antialiased',
                        }}
                      >
                        {p.icon === 'mountain' ? (
                          <svg viewBox="0 0 24 16" aria-hidden="true" style={{ width: 'clamp(28px,5cqw,48px)', height: 'auto' }}>
                            <path d="M1 15 L8 4 L11.5 9 L15 2 L23 15 Z" fill="var(--maroon)" stroke="var(--maroon)" strokeWidth="1" strokeLinejoin="round" />
                            <path d="M12.2 7.8 L15 2 L17.8 7.8 L16.5 6.6 L15.7 7.6 L15 6.2 L14.3 7.6 L13.5 6.6 Z" fill="var(--white)" />
                          </svg>
                        ) : (
                          <SiteIcon name={p.icon} size={36} color="var(--maroon)" style={{ pointerEvents: 'none' }} />
                        )}
                        <span
                          style={{
                            fontSize: 'clamp(11px,1.5cqw,15px)',
                            fontWeight: 700,
                            letterSpacing: '.14em',
                            textTransform: 'uppercase',
                            lineHeight: 1.2,
                            color: lit(p.id) ? 'var(--sky-deep)' : 'var(--maroon)',
                            transition: 'color var(--dur-quick) var(--ease-breath)',
                          }}
                        >
                          {p.name}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {p.sights.map((s) => (
                            <span key={s} style={{ fontSize: 'clamp(10px,1.2cqw,13px)', fontWeight: 500, lineHeight: 1.35, color: 'var(--ink)', textWrap: 'balance' }}>
                              {s}
                            </span>
                          ))}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
