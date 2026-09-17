import type { CSSProperties, ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'pine' | 'saffron' | 'maroon' | 'gold'

export type BadgeProps = {
  tone?: BadgeTone
  children?: ReactNode
  style?: CSSProperties
}

const TONES: Record<BadgeTone, CSSProperties> = {
  neutral: { color: 'var(--text-muted)', border: '1px solid var(--border-hairline)' },
  pine: { color: 'var(--pine)', border: '1px solid var(--pine-soft)', background: 'var(--pine-soft)' },
  saffron: { color: 'var(--wood)', border: '1px solid var(--saffron-soft)', background: 'var(--saffron-soft)' },
  maroon: { color: 'var(--paper)', border: '1px solid var(--maroon)', background: 'var(--maroon)' },
  gold: { color: 'var(--wood)', border: '1px solid var(--gold)' },
}

/** Quiet metadata label: difficulty, season, altitude band. Never for promotions. */
export function Badge({ tone = 'neutral', children, style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 10px',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-sans-body)',
        fontSize: 'var(--text-micro)',
        fontWeight: 500,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        lineHeight: 1,
        ...TONES[tone],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
