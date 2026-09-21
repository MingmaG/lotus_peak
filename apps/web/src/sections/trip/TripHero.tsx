'use client'

import { Eyebrow } from '@/design-system'
import { Parallax, Reveal, ScrollCue } from '@/motion'
import { heroOffset } from '../shared/Section'

export function TripHero({
  image,
  title,
  meta,
  regions,
}: {
  image: string
  title: string
  meta: string
  regions: string
}) {
  return (
    <Parallax
      src={image}
      speed={0.6}
      priority
      style={{
        height: '92svh',
        minHeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        ...heroOffset,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(31,29,26,.42)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'var(--protection)' }} />
      <div
        style={{
          position: 'relative',
          padding: 'calc(var(--nav-h)) var(--gutter) 0',
          color: 'var(--paper)',
          maxWidth: 960,
          display: 'grid',
          justifyItems: 'center',
          gap: 24,
        }}
      >
        <Reveal>
          <Eyebrow tone="inverse">{meta}</Eyebrow>
        </Reveal>
        <Reveal delay={240}>
          <h1 style={{ fontSize: 'var(--text-display)', lineHeight: 1.02, maxWidth: '16ch' }}>{title}</h1>
        </Reveal>
        <Reveal delay={520}>
          <p
            style={{
              fontSize: 'var(--text-small)',
              letterSpacing: 'var(--tracking-nav)',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.8)',
            }}
          >
            {regions}
          </p>
        </Reveal>
        <Reveal delay={800}>
          <div style={{ marginTop: 24 }}>
            <ScrollCue />
          </div>
        </Reveal>
      </div>
    </Parallax>
  )
}
