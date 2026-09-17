'use client'

import { useId, useState, type CSSProperties, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type Native = InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>

export type InputProps = Omit<Native, 'style'> & {
  label?: string
  hint?: string
  error?: string
  multiline?: boolean
  style?: CSSProperties
}

/** Underlined text field; label above in tracked caps. Multiline for messages. */
export function Input({ label, hint, error, multiline, style, id, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false)
  const auto = useId()
  const fieldId = id || auto
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const s: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: 'transparent',
    border: 0,
    borderBottom: `1px solid ${error ? 'var(--maroon)' : focus ? 'var(--ink)' : 'var(--border-strong)'}`,
    padding: '10px 0',
    fontFamily: 'var(--font-sans-body)',
    fontSize: '1.0625rem',
    color: 'var(--text-body)',
    outline: 'none',
    transition: 'border-color var(--dur-quick) var(--ease-breath)',
    borderRadius: 0,
  }

  const shared = {
    id: fieldId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
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
      {multiline ? (
        <textarea rows={4} {...rest} {...shared} style={{ ...s, resize: 'vertical', lineHeight: 1.6 }} />
      ) : (
        <input {...rest} {...shared} style={s} />
      )}
      {hint && !error && (
        <div id={hintId} style={{ marginTop: 8, fontSize: 'var(--text-small)', color: 'var(--text-faint)' }}>
          {hint}
        </div>
      )}
      {error && (
        <div
          id={errorId}
          role="alert"
          style={{ marginTop: 8, fontSize: 'var(--text-small)', color: 'var(--maroon)' }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
