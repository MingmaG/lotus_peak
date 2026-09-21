'use client'

import Link from 'next/link'
import { useState, type CSSProperties, type ReactNode } from 'react'

type Variant = 'primary' | 'outline' | 'ghost' | 'inverse'
type Size = 'sm' | 'md' | 'lg'

const V: Record<Variant, CSSProperties & { fill?: string; hoverColor?: string; hoverBorder?: string }> = {
  primary: {
    background: 'var(--cta-bg)',
    color: 'var(--cta-fg)',
    border: '1px solid var(--cta-bg)',
    fill: 'var(--cta-bg-hover)',
    hoverColor: 'var(--cta-fg)',
    hoverBorder: 'var(--cta-bg-hover)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-body)',
    border: '1px solid var(--border-strong)',
    fill: 'var(--ink)',
    hoverColor: 'var(--paper)',
    hoverBorder: 'var(--ink)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-accent)',
    border: '1px solid transparent',
    paddingLeft: 0,
    paddingRight: 0,
  },
  inverse: {
    background: 'transparent',
    color: 'var(--text-on-ground)',
    border: '1px solid rgba(255,255,255,.5)',
    fill: 'var(--paper)',
    hoverColor: 'var(--ink)',
    hoverBorder: 'var(--paper)',
  },
}

const S: Record<Size, CSSProperties> = {
  sm: { padding: '10px 18px', fontSize: '.75rem' },
  md: { padding: '14px 28px', fontSize: '.875rem' },
  lg: { padding: '18px 36px', fontSize: '.9375rem' },
}

export type ButtonProps = {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  href?: string
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  children?: ReactNode
  style?: CSSProperties
  'aria-label'?: string
}

/**
 * Filled variants hover like water rising: a fill layer grows from the bottom
 * edge over --dur-slow on --ease-settle, and the label recolours as the level
 * passes it. Ghost simply deepens to maroon-2.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  disabled,
  href,
  onClick,
  type = 'button',
  style,
  ...rest
}: ButtonProps) {
  const [hov, setHov] = useState(false)
  const [act, setAct] = useState(false)
  const on = hov && !disabled
  const { fill, hoverColor, hoverBorder, ...v } = V[variant]

  const base: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    fontFamily: 'var(--font-sans-body)',
    fontWeight: 500,
    letterSpacing: 'var(--tracking-label)',
    textTransform: 'uppercase',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    textDecoration: 'none',
    lineHeight: 1,
    transition:
      'color var(--dur-slow) var(--ease-settle),border-color var(--dur-slow) var(--ease-settle),transform var(--dur-quick) var(--ease-breath)',
    transform: act ? 'scale(.985)' : 'none',
    whiteSpace: 'nowrap',
  }

  const vv = { ...v }
  if (on) {
    if (fill) {
      vv.color = hoverColor
      vv.border = `1px solid ${hoverBorder}`
    } else {
      vv.color = 'var(--maroon-2)'
    }
  }

  const water = fill ? (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: fill,
        transformOrigin: 'bottom',
        transform: on ? 'scaleY(1)' : 'scaleY(0)',
        transition: 'transform var(--dur-slow) var(--ease-settle)',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  ) : null

  const handlers = {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => {
      setHov(false)
      setAct(false)
    },
    onMouseDown: () => setAct(true),
    onMouseUp: () => setAct(false),
    onFocus: () => setHov(true),
    onBlur: () => setHov(false),
  }

  const merged = { ...base, ...S[size], ...vv, ...style }

  if (href) {
    return (
      <Link href={href} onClick={onClick} style={merged} {...handlers} {...rest}>
        {water}
        {icon}
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={merged} {...handlers} {...rest}>
      {water}
      {icon}
      {children}
    </button>
  )
}
