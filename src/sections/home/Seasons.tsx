'use client'

import { useState } from 'react'
import { Disclosure, Eyebrow } from '@/design-system'
import { Parallax, Reveal } from '@/motion'
import type { Season } from '@/content/types'

/**
 * The seasons block. Each row: months and name, the headline and summary with
 * an inline "Read more" disclosure over the detail paragraph, and a parallax
 * image at speed .4 whose width alternates.
 */
export function Seasons({ seasons }: { seasons: Season[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-8)', marginTop: 'var(--space-9)' }}>
      {seasons.map((s, i) => (
        <SeasonRow key={s.key} season={s} index={i} />
      ))}
    </div>
  )
}

function SeasonRow({ season, index }: { season: Season; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <Reveal
      y={36}
      className="lp-season"
      style={{
        display: 'grid',
        gridTemplateColumns: '160px minmax(0,1fr) minmax(0,1fr)',
        gap: 'var(--space-8)',
        alignItems: 'start',
        paddingTop: 'var(--space-7)',
        borderTop: '1px solid var(--border-hairline)',
      }}
    >
      <div>
        <Eyebrow tone="muted">{season.monthsLabel}</Eyebrow>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-h2)',
            fontWeight: 'var(--weight-display)',
          }}
        >
          {season.name}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 'var(--text-h3)' }}>{season.headline}</h3>
        <p style={{ marginTop: 14, color: 'var(--text-muted)', maxWidth: 'var(--measure-narrow)' }}>
          {season.summary}
        </p>

        <Disclosure
          variant="inline"
          open={open}
          onToggle={() => setOpen((o) => !o)}
          summary={null}
          labels={['Read more', 'Read less']}
        >
          <p style={{ margin: '14px 0 0', color: 'var(--text-muted)', maxWidth: 'var(--measure-narrow)' }}>
            {season.detail}
          </p>
        </Disclosure>
      </div>

      <Parallax
        src={season.image}
        speed={0.4}
        sizes="(max-width: 900px) 100vw, 50vw"
        style={{
          aspectRatio: '16/9',
          borderRadius: 'var(--radius-sm)',
          justifySelf: 'end',
          width: index % 2 ? '80%' : '100%',
        }}
      />
    </Reveal>
  )
}
