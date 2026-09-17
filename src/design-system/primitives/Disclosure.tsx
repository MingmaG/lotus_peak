'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'

/**
 * The plus/minus toggle: two hairlines, the vertical one collapsing when open.
 * Used by Disclosure and by the itinerary's day rows.
 */
export function PlusMinus({ open, color = 'var(--ink)' }: { open: boolean; color?: string }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: 24, height: 24, flex: 'none' }}>
      <span style={{ position: 'absolute', left: 4, right: 4, top: 11.5, height: 1, background: color }} />
      <span
        style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          left: 11.5,
          width: 1,
          background: color,
          transform: open ? 'scaleY(0)' : 'none',
          transition: 'transform var(--dur-quick) var(--ease-breath)',
        }}
      />
    </span>
  )
}

export type DisclosureProps = {
  open: boolean
  onToggle: () => void
  /** The always-visible row. Rendered inside the button. */
  summary: ReactNode
  children: ReactNode
  /** "Read more" / "Read less" style trigger instead of a full-width row. */
  variant?: 'row' | 'inline'
  labels?: [closed: string, open: string]
  style?: CSSProperties
}

/**
 * One animated show/hide, replacing the three different implementations in the
 * design project — the season rows animate with grid-template-rows, the FAQ
 * pops instantly, and neither pairs its button to its panel (audit B12).
 *
 * The 0fr → 1fr grid transition is the only way to animate to auto height.
 * The panel stays in the DOM when closed, so in-page search and crawlers find it.
 */
export function Disclosure({
  open,
  onToggle,
  summary,
  children,
  variant = 'row',
  labels,
  style,
}: DisclosureProps) {
  const panelId = useId()
  const buttonId = `${panelId}-button`

  const trigger =
    variant === 'inline' ? (
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 18,
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'var(--ink)',
          fontSize: 'var(--text-micro)',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
        }}
      >
        <PlusMinus open={open} />
        {open ? (labels?.[1] ?? 'Read less') : (labels?.[0] ?? 'Read more')}
      </button>
    ) : (
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24,
          width: '100%',
          background: 'none',
          border: 0,
          padding: '22px 0',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
          fontSize: 'var(--text-h3)',
          fontWeight: 'var(--weight-display)',
        }}
      >
        {summary}
        <PlusMinus open={open} />
      </button>
    )

  const panel = (
    <div
      id={panelId}
      role="region"
      aria-labelledby={buttonId}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows var(--dur-slow) var(--ease-breath)',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <div
          style={{
            opacity: open ? 1 : 0,
            transform: open ? 'none' : 'translateY(-6px)',
            transition: 'opacity var(--dur-slow) var(--ease-breath),transform var(--dur-slow) var(--ease-breath)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )

  // Inline puts the panel above the trigger (the season rows read that way).
  return (
    <div style={style}>
      {variant === 'inline' ? (
        <>
          {panel}
          {trigger}
        </>
      ) : (
        <>
          {trigger}
          {panel}
        </>
      )}
    </div>
  )
}
