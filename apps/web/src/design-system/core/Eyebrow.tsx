import type { CSSProperties, ReactNode } from 'react'

export type EyebrowProps = {
  number?: string
  tone?: 'accent' | 'muted' | 'inverse'
  children?: ReactNode
  style?: CSSProperties
}

/** Small tracked label above a heading, optionally numbered (01 — Our purpose). */
export function Eyebrow({ number, tone = 'accent', children, style }: EyebrowProps) {
  const color = {
    accent: 'var(--text-accent)',
    muted: 'var(--text-muted)',
    inverse: 'var(--saffron-2)',
  }[tone]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: 'var(--font-sans-body)',
        fontSize: 'var(--text-label)',
        fontWeight: 500,
        letterSpacing: 'var(--tracking-label)',
        textTransform: 'uppercase',
        color,
        ...style,
      }}
    >
      {number && <span>{number}</span>}
      {number && <span style={{ width: 24, borderTop: '1px solid currentColor', opacity: 0.6 }} />}
      <span>{children}</span>
    </span>
  )
}
