'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { altFor } from '@/lib/assets'
import { subscribe, type Frame } from './ScrollBroker'
import { usePrefersReducedMotion } from './hooks'
import { Reveal } from './Reveal'

/**
 * `[src, aspect-ratio, width, alt]`.
 *
 * The mixed ratios are what make it read as a contact sheet. `alt` is fourth
 * and optional because this is a client component: the description lives in
 * the media payload the *server* fetched, and a module-level lookup here would
 * read the client bundle's own empty copy of it. It has to arrive as data.
 */
export type StripImage = [src: string, ratio?: string, width?: string, alt?: string]

export type StripProps = {
  images: StripImage[]
  caption?: string
}

/**
 * Horizontal gallery scrubbed by the page scroll.
 *
 *   p      = clamp((vh - rect.top) / (vh + rect.height), 0, 1)
 *   offset = p * (trackWidth - frameWidth) * 0.9
 *
 * Two fixes from the audit. B5: the track is transformed rather than having its
 * scrollLeft written every frame, and the frame is overflow-hidden, so it never
 * advertises a drag it would immediately override. B6: under reduced motion the
 * frame becomes a genuinely scrollable region and nothing is driven at all.
 */
export function Strip({ images, caption }: StripProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const frame = frameRef.current
    const track = trackRef.current
    if (!frame || !track || reduced) return

    return subscribe(
      frame,
      (node, f: Frame) => {
        const r = node.getBoundingClientRect()
        return Math.min(1, Math.max(0, (f.vh - r.top) / (f.vh + r.height)))
      },
      (_node, p: number) => {
        const distance = track.scrollWidth - frame.clientWidth
        if (distance <= 0) return
        track.style.transform = `translate3d(${(-p * distance * 0.9).toFixed(1)}px,0,0)`
      },
    )
  }, [reduced])

  return (
    <section aria-label="Gallery" style={{ padding: 'var(--space-9) 0' }}>
      <div ref={frameRef} className="strip" tabIndex={reduced ? 0 : -1}>
        <div ref={trackRef} className="strip-track">
          {images.map(([src, ratio, width, alt], i) => (
            <Reveal key={src + i} delay={i * 320} style={{ flex: 'none', width: width || '34vw', minWidth: 280 }}>
              {/* The track width is the `width` column of the data, which is
                  exactly the `sizes` the browser needs to pick from the srcset. */}
              <div style={{ position: 'relative', aspectRatio: ratio || '4/3' }}>
                <Image
                  src={src}
                  alt={alt ?? altFor(src)}
                  fill
                  sizes={width || '34vw'}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      {caption && (
        <p
          style={{
            marginTop: 24,
            padding: '0 var(--gutter)',
            fontSize: 'var(--text-small)',
            color: 'var(--text-muted)',
          }}
        >
          {caption}
        </p>
      )}
    </section>
  )
}
