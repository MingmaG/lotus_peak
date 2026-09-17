'use client'

import type { ReactNode } from 'react'
import { Parallax } from './Parallax'
import { Reveal } from './Reveal'

export type BandProps = {
  src: string
  alt?: string
  eyebrow?: string
  title?: string
  body?: string
  cta?: string
  onCta?: () => void
  /** Default 88vh. Home's closing band is 70vh, the trail band 80vh, Culture's 76vh. */
  height?: string
  align?: 'center' | 'left'
  children?: ReactNode
}

/**
 * Full-bleed chapter opener: parallax at speed 1.2 under two scrims, with the
 * copy staged 0 / 240 / 480 / 720.
 */
export function Band({
  src,
  alt = '',
  eyebrow,
  title,
  body,
  cta,
  onCta,
  height = '88vh',
  align = 'center',
  children,
}: BandProps) {
  const centred = align === 'center'
  const rule = <span style={{ width: 48, borderTop: '1px solid var(--gold)' }} />

  return (
    <Parallax
      src={src}
      alt={alt}
      speed={1.2}
      style={{
        height,
        minHeight: 560,
        display: 'flex',
        alignItems: 'center',
        justifyContent: centred ? 'center' : 'flex-start',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(31,29,26,.38)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top,rgba(31,29,26,.55),transparent 40%,rgba(31,29,26,.25))',
        }}
      />
      <div
        style={{
          position: 'relative',
          color: 'var(--paper)',
          padding: '0 var(--gutter)',
          maxWidth: centred ? 880 : 'var(--container)',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
          textAlign: centred ? 'center' : 'left',
          display: 'grid',
          justifyItems: centred ? 'center' : 'start',
          gap: 24,
        }}
      >
        {eyebrow && (
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 20 }}>
              {rule}
              <span
                style={{
                  fontSize: 'var(--text-label)',
                  letterSpacing: 'var(--tracking-nav)',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                  color: 'var(--saffron-2)',
                }}
              >
                {eyebrow}
              </span>
              {centred && rule}
            </div>
          </Reveal>
        )}
        {title && (
          <Reveal delay={240}>
            <h2 style={{ fontSize: 'var(--text-display)', maxWidth: '14ch', lineHeight: 1.02 }}>{title}</h2>
          </Reveal>
        )}
        {body && (
          <Reveal delay={480}>
            <p
              style={{
                fontSize: 'var(--text-lead)',
                lineHeight: 'var(--leading-lead)',
                maxWidth: 'var(--measure-narrow)',
                color: 'rgba(255,255,255,.85)',
              }}
            >
              {body}
            </p>
          </Reveal>
        )}
        {cta && (
          <Reveal delay={720}>
            <button
              type="button"
              onClick={onCta}
              style={{
                background: 'none',
                border: 0,
                borderBottom: '1px solid var(--saffron-2)',
                padding: '6px 0',
                color: 'var(--paper)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-label)',
                letterSpacing: 'var(--tracking-nav)',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {cta}
            </button>
          </Reveal>
        )}
        {children}
      </div>
    </Parallax>
  )
}
