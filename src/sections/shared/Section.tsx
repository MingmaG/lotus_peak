import type { CSSProperties, ReactNode } from 'react'
import { Divider, Eyebrow } from '@/design-system'
import { Reveal, ShadowArt, type MotifName } from '@/motion'

type Base = {
  id?: string
  eyebrow?: string
  num?: string
  title?: string
  lead?: string
  children?: ReactNode
  style?: CSSProperties
}

/**
 * Motif props are only accepted on dark sections. On a paper ground the
 * page-wide Dignities layer is the ground, and the two must never overlap —
 * the type makes the mistake in the design project impossible to repeat
 * (docs/audit/effects-integration.md B1).
 */
export type SectionProps = Base &
  (
    | { ground: true; motif?: MotifName; motifSide?: 'left' | 'right' | 'center'; motifSize?: string }
    | { ground?: false; motif?: never; motifSide?: never; motifSize?: never }
  )

export function Section({ id, eyebrow, num, title, lead, children, ground, style, ...motif }: SectionProps) {
  return (
    <section
      id={id}
      style={{
        position: 'relative',
        padding: 'var(--space-10) var(--gutter)',
        background: ground ? 'var(--surface-ground)' : 'transparent',
        color: ground ? 'var(--text-on-ground)' : 'inherit',
        ...style,
      }}
    >
      {ground && (
        <ShadowArt
          ground
          name={motif.motif}
          side={motif.motifSide}
          size={motif.motifSize}
          offset="var(--gutter)"
        />
      )}
      <div style={{ position: 'relative', maxWidth: 'var(--container)', margin: '0 auto' }}>
        {eyebrow && (
          <Reveal>
            <Eyebrow number={num} tone={ground ? 'inverse' : 'accent'}>
              {eyebrow}
            </Eyebrow>
          </Reveal>
        )}
        {title && (
          <Reveal delay={200}>
            <h2 style={{ fontSize: 'var(--text-h2)', marginTop: 20, maxWidth: '24ch' }}>{title}</h2>
          </Reveal>
        )}
        {lead && (
          <Reveal delay={400}>
            <p
              style={{
                marginTop: 20,
                fontSize: 'var(--text-lead)',
                lineHeight: 'var(--leading-lead)',
                maxWidth: 'var(--measure-narrow)',
                color: ground ? 'rgba(247,243,236,.75)' : 'var(--text-muted)',
              }}
            >
              {lead}
            </p>
          </Reveal>
        )}
        {children}
      </div>
    </section>
  )
}

/** A woven kera rule between sections, inset to the container. */
export function KeraRule() {
  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '0 var(--gutter)' }}>
      <div style={{ maxWidth: 'var(--container)', margin: '0 auto' }}>
        <Divider variant="kera" />
      </div>
    </div>
  )
}

/** Centred header with flanking gold rules. Used by the itinerary and FAQ openers. */
export function Centered({ eyebrow, title }: { eyebrow: string; title: string }) {
  const rule = <span style={{ width: 56, borderTop: '1px solid var(--gold)' }} />
  return (
    <div style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 20 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 20 }}>
        {rule}
        <Eyebrow>{eyebrow}</Eyebrow>
        {rule}
      </div>
      <h2 style={{ fontSize: 'var(--text-h2)', maxWidth: '20ch' }}>{title}</h2>
    </div>
  )
}

/** A gold-ruled label/value pair from the trip "At a glance" grid. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-gold)', paddingTop: 16 }}>
      <Eyebrow tone="muted">{label}</Eyebrow>
      <div style={{ marginTop: 8, fontSize: 'var(--text-body-size)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

/** Full-bleed hero offset: pulls the section up under the transparent nav. */
export const heroOffset: CSSProperties = { marginTop: 'calc(var(--nav-h) * -1)' }
