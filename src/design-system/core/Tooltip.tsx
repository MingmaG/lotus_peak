'use client'

import { useId, useState, type ReactNode } from 'react'

export type TooltipProps = {
  label: string
  children: ReactNode
}

/** Ink tooltip on hover/focus for terse explanations (SDF, altitude). */
export function Tooltip({ label, children }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-describedby={id}
    >
      {children}
      <span
        id={id}
        role="tooltip"
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: `translateX(-50%) translateY(${open ? 0 : 4}px)`,
          opacity: open ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity var(--dur-quick) var(--ease-breath),transform var(--dur-quick) var(--ease-breath)',
          background: 'var(--ink)',
          color: 'var(--paper)',
          padding: '7px 11px',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-sans-body)',
          fontSize: '.8125rem',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}
      >
        {label}
      </span>
    </span>
  )
}
