'use client'

import Image from 'next/image'
import { Parallax, Reveal } from '@/motion'

/**
 * The overlapping overview pair: a 4/5 parallax image with a second, smaller
 * portrait offset into its bottom-right corner, separated by a 6px paper border.
 *
 * Both photographs are the office's choice now. They were the journey's hero
 * and one stock picture written into the page — which meant the same person
 * walking in the corner of every journey, including the ones that do no
 * walking. `main` falls back to the hero and `inset` to the first photograph
 * in the strip; where a journey has neither, the pair becomes the single
 * photograph rather than a hole in the corner.
 *
 * `main` is usually the same photograph as the page hero, and is decorative
 * when it is — describing it twice on one page tells a screen-reader user
 * nothing new. A main photograph the office chose *differently* from the hero
 * is a second picture and carries its description.
 */
export function TripOverviewImages({
  main,
  mainAlt,
  inset,
  insetAlt,
}: {
  main: string
  /**
   * The main photograph's description, where it is a second picture.
   *
   * Absent renders it decorative, which is right when it *is* the hero — the
   * page passes it only when the office chose something else. See above.
   */
  mainAlt?: string
  /** Null where the journey has no second photograph to inset. */
  inset?: string | null
  /** The inset photograph's description. See TrekCard's `imageAlt`. */
  insetAlt?: string
}) {
  return (
    <div
      style={
        inset
          ? { position: 'relative', paddingBottom: '22%', paddingRight: '18%' }
          : { position: 'relative' }
      }
    >
      <Reveal y={40}>
        <Parallax
          src={main}
          alt={mainAlt ?? ''}
          speed={0.5}
          sizes="(max-width: 900px) 82vw, 40vw"
          style={{ aspectRatio: '4/5', borderRadius: 'var(--radius-sm)' }}
        />
      </Reveal>
      {inset && (
        <Reveal delay={400} y={60} style={{ position: 'absolute', right: 0, bottom: 0, width: '52%' }}>
          <div style={{ position: 'relative', aspectRatio: '3/4' }}>
            <Image
              src={inset}
              alt={insetAlt ?? ''}
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
      )}
    </div>
  )
}
