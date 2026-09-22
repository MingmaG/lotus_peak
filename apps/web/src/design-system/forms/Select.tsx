'use client'

import { useId, useState, type CSSProperties, type SelectHTMLAttributes } from 'react'

export type SelectOption = string | { label: string; value: string }

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'style'> & {
  label?: string
  options: SelectOption[]
  style?: CSSProperties
}

/** Underlined native select with chevron. */
export function Select({ label, options = [], style, id, ...rest }: SelectProps) {
  const [focus, setFocus] = useState(false)
  const auto = useId()
  const fieldId = id || auto

  const s: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'transparent',
    border: 0,
    borderBottom: `1px solid ${focus ? 'var(--ink)' : 'var(--border-strong)'}`,
    padding: '10px 0',
    fontFamily: 'var(--font-sans-body)',
    fontSize: '1.0625rem',
    color: 'var(--text-body)',
    outline: 'none',
    transition: 'border-color var(--dur-quick) var(--ease-breath)',
    borderRadius: 0,
  }

  return (
    <div style={style}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            display: 'block',
            fontFamily: 'var(--font-sans-body)',
            fontSize: 'var(--text-label)',
            fontWeight: 500,
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          id={fieldId}
          {...rest}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ ...s, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}
        >
          {options.map((o) =>
            typeof o === 'string' ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ),
          )}
        </select>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{
            position: 'absolute',
            right: 2,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  )
}
