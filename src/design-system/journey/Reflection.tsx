import type { CSSProperties } from 'react'

export type ReflectionProps = {
  quote: string
  name: string
  detail?: string
  style?: CSSProperties
}

/** Testimonial framed as a reflection: gold rule, quote, quiet attribution. No stars, no ratings. */
export function Reflection({ quote, name, detail, style }: ReflectionProps) {
  return (
    <figure style={{ margin: 0, fontFamily: 'var(--font-sans-body)', ...style }}>
      <div style={{ width: 32, borderTop: '1px solid var(--gold)', marginBottom: 24 }} />
      <blockquote
        style={{
          margin: 0,
          fontFamily: 'var(--font-serif-display)',
          fontSize: 'clamp(1.4rem,2.2vw,1.9rem)',
          lineHeight: 1.35,
          color: 'var(--ink)',
          maxWidth: '30ch',
        }}
      >
        {quote}
      </blockquote>
      <figcaption style={{ marginTop: 22, fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
        {name}
        {detail && <span style={{ color: 'var(--text-faint)' }}> · {detail}</span>}
      </figcaption>
    </figure>
  )
}
