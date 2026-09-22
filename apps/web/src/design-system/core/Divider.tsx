import type { CSSProperties } from 'react'
import { asset } from '@/lib/assets'

export type DividerProps = {
  variant?: 'hairline' | 'gold' | 'flags' | 'kera'
  width?: number | string
  /** kera only. Default 6. */
  height?: number
  style?: CSSProperties
}

const FLAGS = ['--flag-blue', '--flag-white', '--flag-red', '--flag-green', '--flag-yellow']

/**
 * Hairline, a short gold rule, the five-colour prayer-flag rule (at most once
 * per page), or a thin woven kera textile rule between sections.
 */
export function Divider({ variant = 'hairline', width, height, style }: DividerProps) {
  if (variant === 'flags') {
    return (
      <div aria-hidden="true" style={{ display: 'flex', height: 3, width: width || '100%', ...style }}>
        {FLAGS.map((c) => (
          <div key={c} style={{ flex: 1, background: `var(${c})` }} />
        ))}
      </div>
    )
  }

  if (variant === 'kera') {
    return (
      <div
        aria-hidden="true"
        style={{
          height: height || 6,
          width: width || '100%',
          backgroundImage: `url(${asset('textures/kera-strip.png')})`,
          backgroundSize: 'auto 100%',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
          ...style,
        }}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: width || (variant === 'gold' ? 48 : '100%'),
        borderTop: variant === 'gold' ? '1px solid var(--gold)' : '1px solid var(--border-hairline)',
        ...style,
      }}
    />
  )
}
