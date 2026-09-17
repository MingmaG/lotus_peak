import type { CSSProperties } from 'react'
import Image from 'next/image'
import { asset, altFor } from '@/lib/assets'

export type WindowFrameProps = {
  src?: string
  alt?: string
  /** CSS aspect-ratio of the photo opening. Default "4/3". */
  aspectRatio?: string
  /** ink on paper (default) or paper lines on a dark ground */
  tone?: 'ink' | 'paper'
  /** How wide the frame renders, for the srcset. */
  sizes?: string
  style?: CSSProperties
}

/** Intrinsic size of the carved timber pieces, so they reserve their height. */
const CORNICE = { width: 567, height: 120 }
const BASE = { width: 567, height: 100 }

/**
 * Photograph set inside a traditional Bhutanese rabsel window: carved cornice
 * above, timber base below. One hero-scale image per page, never in a grid.
 */
export function WindowFrame({
  src,
  alt,
  aspectRatio = '4/3',
  tone = 'ink',
  sizes = '(max-width: 900px) 100vw, 50vw',
  style,
}: WindowFrameProps) {
  const filter = tone === 'paper' ? 'invert(1) brightness(1.4)' : 'none'
  const blend = tone === 'paper' ? ('screen' as const) : ('multiply' as const)
  const carving: CSSProperties = { width: '100%', height: 'auto', display: 'block', filter, mixBlendMode: blend }

  return (
    <figure style={{ margin: 0, display: 'grid', gap: 0, ...style }}>
      <Image
        src={asset('ornaments/window-cornice.png')}
        alt=""
        aria-hidden="true"
        {...CORNICE}
        sizes={sizes}
        style={carving}
      />
      <div
        style={{
          position: 'relative',
          margin: '-1px 15% 0',
          aspectRatio,
          overflow: 'hidden',
          background: 'var(--paper-3)',
          boxShadow: 'inset 0 0 0 1px var(--border-strong)',
        }}
      >
        {src && (
          <Image
            src={src}
            alt={alt ?? altFor(src)}
            fill
            sizes={sizes}
            style={{ objectFit: 'cover' }}
          />
        )}
      </div>
      <Image
        src={asset('ornaments/window-base.png')}
        alt=""
        aria-hidden="true"
        {...BASE}
        sizes={sizes}
        style={{ ...carving, marginTop: -1, position: 'relative' }}
      />
    </figure>
  )
}
