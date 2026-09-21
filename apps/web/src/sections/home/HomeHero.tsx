'use client'

import { Button, Eyebrow } from '@/design-system'
import { Parallax, Reveal, ScrollCue } from '@/motion'
import { heroOffset } from '../shared/Section'

/**
 * The home hero. Parallax at speed .6 with the 24s `mist` drift layered on top
 * of the transform, under a bottom-weighted gradient, staged 0/240/520/760.
 */
export function HomeHero({ image, alt }: { image: string; alt?: string }) {
  return (
    <Parallax
      src={image}
      alt={alt}
      speed={0.6}
      priority
      imgStyle={{ animation: 'mist var(--dur-mist) var(--ease-drift) infinite alternate' }}
      style={{ height: '100svh', minHeight: 640, display: 'flex', alignItems: 'flex-end', ...heroOffset }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top,rgba(31,29,26,.78),rgba(31,29,26,.12) 55%,rgba(31,29,26,.3))',
        }}
      />
      <div
        className="lp-two-col"
        style={{
          position: 'relative',
          padding: '0 var(--gutter) var(--space-8)',
          maxWidth: 'var(--container)',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          color: 'var(--paper)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'end',
          gap: 'var(--space-8)',
        }}
      >
        <div style={{ display: 'grid', gap: 28 }}>
          <Reveal>
            <Eyebrow tone="inverse">Lotus Peak · Bhutan</Eyebrow>
          </Reveal>
          <Reveal delay={240}>
            <h1 style={{ fontSize: 'var(--text-display)', lineHeight: 1, maxWidth: '12ch' }}>
              The valleys that still keep time
            </h1>
          </Reveal>
          <Reveal delay={520}>
            <p
              style={{
                fontSize: 'var(--text-lead)',
                lineHeight: 'var(--leading-lead)',
                maxWidth: 'var(--measure-narrow)',
                color: 'rgba(247,243,236,.85)',
              }}
            >
              Mindful journeys through Bhutan, led slowly, with monks and Lams, and days written in for doing
              nothing.
            </p>
          </Reveal>
          <Reveal delay={760}>
            <div>
              <Button variant="inverse" size="lg" href="/trips">
                Explore trips
              </Button>
            </div>
          </Reveal>
        </div>
        <ScrollCue />
      </div>
    </Parallax>
  )
}
