'use client'

import Image from 'next/image'
import { altFor } from '@/lib/assets'
import { Parallax, Reveal } from '@/motion'

/**
 * The overlapping overview pair: a 4/5 parallax image with a second, smaller
 * portrait offset into its bottom-right corner, separated by a 6px paper border.
 *
 * `main` is the same photograph as the page hero, so it stays decorative here —
 * describing it twice on one page tells a screen-reader user nothing new.
 */
export function TripOverviewImages({ main, inset }: { main: string; inset: string }) {
  return (
    <div style={{ position: 'relative', paddingBottom: '22%', paddingRight: '18%' }}>
      <Reveal y={40}>
        <Parallax
          src={main}
          alt=""
          speed={0.5}
          sizes="(max-width: 900px) 82vw, 40vw"
          style={{ aspectRatio: '4/5', borderRadius: 'var(--radius-sm)' }}
        />
      </Reveal>
      <Reveal delay={400} y={60} style={{ position: 'absolute', right: 0, bottom: 0, width: '52%' }}>
        <div style={{ position: 'relative', aspectRatio: '3/4' }}>
          <Image
            src={inset}
            alt={altFor(inset)}
            fill
            sizes="(max-width: 900px) 43vw, 21vw"
            style={{
              objectFit: 'cover',
              borderRadius: 'var(--radius-sm)',
              border: '6px solid var(--surface-page)',
            }}
          />
        </div>
      </Reveal>
    </div>
  )
}
