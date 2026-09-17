'use client'

import type { ReactNode } from 'react'
import { Button } from '@/design-system/core/Button'
import { Eyebrow } from '@/design-system/core/Eyebrow'
import { Parallax } from './Parallax'
import { Reveal } from './Reveal'

export type SplitProps = {
  src: string
  alt?: string
  ratio?: string
  flip?: boolean
  eyebrow?: string
  num?: string
  title?: string
  children?: ReactNode
  cta?: string
  onCta?: () => void
  ground?: boolean
  caption?: string
  /** Home's Jomzo split uses 1.35fr / 1fr. */
  columns?: string
}

/** Editorial split: parallax image one side, copy the other, each on its own beat. */
export function Split({
  src,
  alt = '',
  ratio = '4/5',
  flip,
  eyebrow,
  num,
  title,
  children,
  cta,
  onCta,
  ground,
  caption,
  columns = 'minmax(0,1fr) minmax(0,1fr)',
}: SplitProps) {
  return (
    <section
      style={{
        padding: 'var(--space-10) var(--gutter)',
        background: ground ? 'var(--surface-sunken)' : 'transparent',
      }}
    >
      <div
        className="lp-split"
        style={{
          maxWidth: 'var(--container)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: columns,
          gap: 'var(--space-10)',
          alignItems: 'center',
          direction: flip ? 'rtl' : 'ltr',
        }}
      >
        <Reveal y={40} style={{ direction: 'ltr' }}>
          <Parallax
            src={src}
            alt={alt}
            speed={0.5}
            sizes="(max-width: 900px) 100vw, 50vw"
            style={{ aspectRatio: ratio, borderRadius: 'var(--radius-sm)' }}
          />
          {caption && (
            <p
              style={{
                margin: '14px 0 0',
                fontSize: 'var(--text-micro)',
                letterSpacing: 'var(--tracking-label)',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
              }}
            >
              {caption}
            </p>
          )}
        </Reveal>

        <div style={{ direction: 'ltr' }}>
          {eyebrow && (
            <Reveal>
              <Eyebrow number={num} tone="accent">
                {eyebrow}
              </Eyebrow>
            </Reveal>
          )}
          <Reveal delay={200}>
            <h2 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '16ch' }}>{title}</h2>
          </Reveal>
          <Reveal delay={400}>
            <div
              style={{
                marginTop: 28,
                display: 'grid',
                gap: 20,
                color: 'var(--text-muted)',
                maxWidth: 'var(--measure)',
              }}
            >
              {children}
            </div>
          </Reveal>
          {cta && (
            <Reveal delay={600}>
              <div style={{ marginTop: 36 }}>
                <Button variant="outline" onClick={onCta}>
                  {cta}
                </Button>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
