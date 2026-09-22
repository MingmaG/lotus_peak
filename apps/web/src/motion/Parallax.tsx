'use client'

import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { useParallax } from './hooks'
import { altFor } from '@/lib/assets'

export type ParallaxProps = {
  src: string
  /** Omit to take the described alt for this asset; pass "" to force decorative. */
  alt?: string
  /** 1.2 for Band, .6 for heroes, .5 for Split, .4 for season images. */
  speed?: number
  /** How wide the frame renders, for the srcset. Full-bleed by default. */
  sizes?: string
  style?: CSSProperties
  imgStyle?: CSSProperties
  className?: string
  children?: ReactNode
  /** Eager-load the LCP hero image. */
  priority?: boolean
}

/**
 * Image translating against the scroll inside a clipped frame.
 *
 * Three nested elements, exactly as the design project has them:
 *   frame (overflow hidden) > breathing wrapper (8s `breathe`) > image (scale 1.14)
 *
 * next/image in `fill` mode renders a bare <img> with no wrapper of its own, so
 * those three elements are still three elements and the transform target is
 * still the image itself. `style` is merged after next/image's own fill styles,
 * so the 1.14 scale survives.
 */
export function Parallax({
  src,
  alt,
  speed = 1,
  sizes = '100vw',
  style,
  imgStyle,
  className,
  children,
  priority,
}: ParallaxProps) {
  const [frame, image] = useParallax<HTMLDivElement, HTMLImageElement>(speed)

  return (
    <div ref={frame} className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {/* No aria-hidden here. It was hiding an image that had no alt to lose;
          now that heroes carry a described alt, hiding the subtree would throw
          that description away again. Decorative callers pass alt="". */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: 'breathe var(--dur-breath) var(--ease-inhale) infinite',
          willChange: 'transform',
        }}
      >
        <Image
          ref={image}
          src={src}
          alt={alt ?? altFor(src)}
          fill
          sizes={sizes}
          priority={priority}
          style={{
            objectFit: 'cover',
            transform: 'scale(1.14)',
            willChange: 'transform',
            ...imgStyle,
          }}
        />
      </div>
      {children}
    </div>
  )
}
