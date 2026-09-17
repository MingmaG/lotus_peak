import type { CSSProperties } from 'react'

export type ToastProps = {
  open?: boolean
  message: string
  tone?: 'pine' | 'error'
  style?: CSSProperties
}

/** Ink status toast with a single saffron dot. Confirmation copy stays calm. */
export function Toast({ open = true, message, tone = 'pine', style }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 20px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--ink)',
        color: 'var(--paper)',
        fontFamily: 'var(--font-sans-body)',
        fontSize: 'var(--text-small)',
        boxShadow: 'var(--shadow-lift)',
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all var(--dur-slow) var(--ease-settle)',
        ...style,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flex: 'none',
          background: tone === 'pine' ? 'var(--saffron-2)' : 'var(--flag-red)',
        }}
      />
      {message}
    </div>
  )
}
