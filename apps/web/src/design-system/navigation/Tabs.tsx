'use client'

import type { CSSProperties } from 'react'

export type TabsProps = {
  tabs: string[]
  value?: string
  onChange?: (tab: string) => void
  style?: CSSProperties
  'aria-label'?: string
}

/** Underline tabs. */
export function Tabs({ tabs = [], value, onChange, style, ...rest }: TabsProps) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--border-hairline)',
        fontFamily: 'var(--font-sans-body)',
        ...style,
      }}
      {...rest}
    >
      {tabs.map((t) => {
        const on = t === value
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(t)}
            style={{
              background: 'none',
              border: 0,
              borderBottom: `1px solid ${on ? 'var(--ink)' : 'transparent'}`,
              marginBottom: -1,
              padding: '12px 0',
              fontFamily: 'inherit',
              fontSize: 'var(--text-label)',
              letterSpacing: 'var(--tracking-nav)',
              textTransform: 'uppercase',
              color: on ? 'var(--ink)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color var(--dur-quick) var(--ease-breath),border-color var(--dur-quick) var(--ease-breath)',
            }}
          >
            {t}
          </button>
        )
      })}
    </div>
  )
}
