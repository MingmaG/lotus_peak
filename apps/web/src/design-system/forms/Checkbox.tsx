'use client'

import { useState, type CSSProperties, type InputHTMLAttributes } from 'react'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'style' | 'type'> & {
  label?: string
  style?: CSSProperties
}

/** Pine-filled square checkbox. */
export function Checkbox({ label, checked, defaultChecked, onChange, name, style, ...rest }: CheckboxProps) {
  const controlled = checked !== undefined
  const [internal, setInternal] = useState(!!defaultChecked)
  const on = controlled ? !!checked : internal

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans-body)',
        fontSize: 'var(--text-body-size)',
        color: 'var(--text-body)',
        ...style,
      }}
    >
      <input
        type="checkbox"
        name={name}
        {...(controlled ? { checked } : { defaultChecked })}
        onChange={(e) => {
          if (!controlled) setInternal(e.target.checked)
          onChange?.(e)
        }}
        {...rest}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          boxSizing: 'border-box',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${on ? 'var(--cta-bg)' : 'var(--border-strong)'}`,
          background: on ? 'var(--cta-bg)' : 'transparent',
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
          transition: 'all var(--dur-quick) var(--ease-breath)',
        }}
      >
        {on && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--paper)" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {label}
    </label>
  )
}
