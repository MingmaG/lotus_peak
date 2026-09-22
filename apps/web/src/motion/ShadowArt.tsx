'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { asset } from '@/lib/assets'
import { subscribe, type Frame } from './ScrollBroker'
import { usePrefersReducedMotion } from './hooks'

/**
 * The per-section motif: a traditional illustration laid behind a section as a
 * desaturated, low-opacity layer, drifting slowly with the scroll.
 *
 * In the design project this is dead code — `ShadowArt` is never exported and
 * every call site reaches the `Shadow` stub instead, which discards four of its
 * five props (audit B1). It is reinstated here for DARK sections only, where
 * the page-wide Dignities layer (multiply at 9% on pine) is invisible, so the
 * two grounds can never collide. That was the original reason motifs were
 * retired; scoping them to dark grounds keeps both.
 */
export const MOTIFS = {
  dragon: 'illustrations/bhutan-dragon.jpg',
  mural: 'illustrations/druk-dragon-mural.jpg',
  friends: 'illustrations/four-harmonious-friends.jpg',
  thangka: 'illustrations/harmonious-friends-thangka.jpg',
  animals: 'illustrations/four-animals.jpg',
  dzong: 'icons/dzong.png',
  'dzong-long': 'icons/dzong-long.png',
  chorten: 'icons/chorten.png',
  stupa: 'icons/stupa.png',
  monastery: 'icons/monastery.png',
  pavilion: 'icons/pavilion.png',
  buddha: 'icons/buddha.png',
  taktsang: 'icons/taktsang.png',
  punakha: 'icons/punakha.png',
  jakar: 'icons/jakar.png',
} as const

/** Intrinsic pixel size of each motif, so next/image can cap its srcset. */
const MOTIF_SIZE = {
  dragon: { width: 600, height: 450 },
  mural: { width: 480, height: 639 },
  friends: { width: 342, height: 500 },
  thangka: { width: 387, height: 516 },
  animals: { width: 399, height: 501 },
  dzong: { width: 150, height: 120 },
  'dzong-long': { width: 320, height: 110 },
  chorten: { width: 120, height: 135 },
  stupa: { width: 110, height: 110 },
  monastery: { width: 315, height: 140 },
  pavilion: { width: 120, height: 125 },
  buddha: { width: 110, height: 125 },
  taktsang: { width: 280, height: 264 },
  punakha: { width: 640, height: 220 },
  jakar: { width: 600, height: 240 },
} as const

export type MotifName = keyof typeof MOTIFS

const SILHOUETTE = new Set<MotifName>([
  'dzong',
  'dzong-long',
  'chorten',
  'stupa',
  'monastery',
  'pavilion',
  'buddha',
  'taktsang',
  'punakha',
  'jakar',
])

export type ShadowArtProps = {
  name?: MotifName
  /** Dark (pine) section. Motifs are only drawn when this is true. */
  ground?: boolean
  side?: 'left' | 'right' | 'center'
  size?: string
  opacity?: number
  offset?: string
}

export function ShadowArt({
  name,
  ground,
  side = 'right',
  size = '72%',
  opacity,
  offset = '-6%',
}: ShadowArtProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [drift, setDrift] = useState(0)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    return subscribe(
      el,
      (node, f: Frame) => {
        const parent = node.parentElement
        if (!parent) return null
        const r = parent.getBoundingClientRect()
        return (r.top + r.height / 2 - f.vh / 2) / (f.vh + r.height)
      },
      (_node, p: number) => setDrift(p * 60),
    )
  }, [reduced])

  // The pine wash is drawn on every dark section, with or without a motif.
  const wash = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to right,rgba(31,43,34,.7),rgba(31,43,34,0) 55%)',
      }}
    />
  )

  if (!ground) return null

  if (!name) {
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {wash}
      </div>
    )
  }

  const sky = SILHOUETTE.has(name)
  const op = opacity ?? (sky ? 0.14 : 0.28)
  const centred = side === 'center'
  const mask = centred
    ? 'radial-gradient(ellipse 50% 50% at 50% 50%,#000 55%,transparent 95%)'
    : 'radial-gradient(ellipse 50% 50% at 50% 50%,#000 45%,transparent 90%)'

  const placement = centred
    ? { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }
    : {
        [side]: offset,
        ...(sky ? { bottom: '-8%' } : { top: '50%', transform: 'translateY(-50%)' }),
      }

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}
    >
      <div
        ref={ref}
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate3d(0,${drift.toFixed(1)}px,0)`,
          willChange: 'transform',
        }}
      >
        <Image
          src={asset(MOTIFS[name])}
          alt=""
          {...MOTIF_SIZE[name]}
          // `size` is a percentage of the section, which is not a valid `sizes`
          // length, so approximate it here. This only steers which srcset entry
          // the browser picks — the CSS width below is what lays the motif out.
          sizes="(max-width: 900px) 90vw, 60vw"
          style={{
            position: 'absolute',
            width: size,
            height: 'auto',
            maxHeight: sky ? 'none' : centred ? '96%' : '92%',
            objectFit: 'contain',
            ...placement,
            filter: sky ? 'invert(1)' : 'grayscale(1) contrast(1.25) brightness(1.1)',
            mixBlendMode: 'luminosity',
            opacity: op,
            ...(sky ? null : { maskImage: mask, WebkitMaskImage: mask }),
          }}
        />
      </div>
      {wash}
    </div>
  )
}
