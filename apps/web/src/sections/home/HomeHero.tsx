'use client'

import { Button } from '@/design-system'
import { Parallax, Reveal, ScrollCue } from '@/motion'
import { heroOffset } from '../shared/Section'

/* Where Taktshang sits in the photograph. The picture is 4:3 and the frame is
   a full viewport, so on any screen wider than 4:3 `cover` throws away the top
   and bottom — centred, that took the monastery's roofline with it, and the
   1.14 overscan and the navigation laid over the top took more. Anchoring both
   the crop and the scale to the top edge keeps the building whole; what is
   lost is the foot of the cliff. */
const FOCUS = '50% 0%'

/**
 * The home hero. Parallax at speed .6 with the 24s `mist` drift layered on top
 * of the transform. One line and one button, centred beneath the monastery so
 * the words never sit over the thing the photograph is of.
 */
export function HomeHero({ image, alt, line }: { image: string; alt?: string; line: string }) {
  return (
    <Parallax
      src={image}
      alt={alt}
      speed={0.6}
      priority
      imgStyle={{
        objectPosition: FOCUS,
        transformOrigin: FOCUS,
        animation: 'mist var(--dur-mist) var(--ease-drift) infinite alternate',
      }}
      style={{ height: '100svh', minHeight: 640, display: 'flex', alignItems: 'flex-end', ...heroOffset }}
    >
      {/* Only the lower half darkens, for the words. The upper half is the
          monastery and the sky, and is left as the photograph has it. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top,rgba(31,29,26,.72),rgba(31,29,26,.28) 40%,rgba(31,29,26,0) 62%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          padding: '0 var(--gutter) var(--space-6)',
          width: '100%',
          color: 'var(--paper)',
          display: 'grid',
          justifyItems: 'center',
          textAlign: 'center',
          gap: 'var(--space-6)',
        }}
      >
        <Reveal>
          <h1
            style={{
              fontSize: 'var(--text-h3)',
              fontWeight: 'var(--weight-medium)',
              lineHeight: 'var(--leading-lead)',
              maxWidth: 'var(--measure-narrow)',
              margin: '0 auto',
            }}
          >
            {line}
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <Button variant="inverse" size="lg" href="/trips">
            Explore trips
          </Button>
        </Reveal>
        <ScrollCue />
      </div>
    </Parallax>
  )
}
