'use client'

import { useState } from 'react'
import Image from 'next/image'
import { asset } from '@/lib/assets'
import { useDocumentProgress, usePrefersReducedMotion } from './hooks'

/**
 * The Four Dignities as one page-wide ground.
 *
 * As the reader scrolls, the same watermark turns through the circle:
 * tiger (awareness) → snow lion (joy and love) → garuda (wisdom) →
 * dragon (compassion). Fixed behind every page, breathing with the imagery;
 * coloured art is desaturated and lifted so only the line survives on paper.
 *
 * Rendered exactly once, in the site layout. The index comes from the scroll
 * broker's measured document height, which recomputes on load and whenever the
 * body resizes — not from the prototype's 700ms timer (audit B7).
 */
const DIGNITIES = [
  {
    src: asset('illustrations/dignity-tiger.png'),
    en: 'Awareness',
    dz: 'དྲན་པ་དང་ཤེས་བཞིན།',
    filter: 'grayscale(1) brightness(1.55) contrast(1.6)',
    side: 'right' as const,
    w: '56vw',
    width: 760,
    height: 731,
  },
  {
    src: asset('illustrations/dignity-snow-lion.png'),
    en: 'Joy and love',
    dz: 'དགའ་བ་དང་བདེ་བ།',
    filter: 'grayscale(1) contrast(1.1)',
    side: 'left' as const,
    w: '50vw',
    width: 736,
    height: 549,
  },
  {
    src: asset('illustrations/dignity-garuda.png'),
    en: 'Wisdom',
    dz: 'ཤེས་རབ་དང་ཡེ་ཤེས།',
    filter: 'grayscale(1) brightness(1.08) contrast(1.15)',
    side: 'right' as const,
    w: '54vw',
    width: 700,
    height: 700,
  },
  {
    src: asset('illustrations/dignity-dragon.jpg'),
    en: 'Compassion',
    dz: 'སྙིང་རྗེ།',
    filter: 'grayscale(1) brightness(1.12) contrast(1.35)',
    side: 'left' as const,
    w: '58vw',
    width: 600,
    height: 450,
  },
]

const MASK = 'radial-gradient(ellipse 50% 50% at 50% 50%,#000 40%,transparent 92%)'

export function Dignities() {
  const [index, setIndex] = useState(0)
  const [offset, setOffset] = useState(0)
  const reduced = usePrefersReducedMotion()

  const ref = useDocumentProgress((p) => {
    setIndex(Math.floor(p * 4))
    if (!reduced) setOffset(-p * 140)
  })

  const current = DIGNITIES[Math.max(0, Math.min(3, index))]!

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-10% 0',
          transform: `translate3d(0,${offset.toFixed(1)}px,0)`,
          willChange: 'transform',
        }}
      >
        {DIGNITIES.map((g, k) => {
          const on = k === index
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

      <div
        style={{
          position: 'absolute',
          right: 28,
          bottom: 40,
          display: 'grid',
          justifyItems: 'end',
          gap: 6,
          textAlign: 'right',
          color: 'var(--text-faint)',
        }}
      >
        <span
          key={current.en}
          style={{
            fontSize: 'var(--text-micro)',
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            animation: 'surface 1.6s var(--ease-settle) both',
          }}
        >
          {current.en}
        </span>
        <span
          key={current.dz}
          lang="dz"
          style={{ fontSize: 13, lineHeight: 1.6, animation: 'surface 1.6s var(--ease-settle) .2s both' }}
        >
          {current.dz}
        </span>
        <span style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {DIGNITIES.map((g, k) => (
            <span
              key={g.en}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: k === index ? 'var(--gold)' : 'currentColor',
                opacity: k === index ? 1 : 0.35,
                transition: 'all 1.2s var(--ease-inhale)',
              }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}
