'use client'

import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useDelayedFlag, useInView } from './hooks'

export type RevealProps = {
  children?: ReactNode
  /** Stagger in ms. See the cadence table in docs/specs/03-motion-and-effects.md §3. */
  delay?: number
  /** Rise distance in px. Default 18; grids use 40. */
  y?: number
  as?: ElementType
  style?: CSSProperties
  className?: string
  id?: string
}

/**
 * Fade + rise + de-blur on entering the viewport.
 *
 * The visual state lives in motion.css, not here: the finished state is the
 * default and `.motion-ready` opts into the animation. That is what keeps the
 * server-rendered page visible without JavaScript (audit B4).
 *
 * Children are passed through untouched, so server-rendered copy stays in the
 * initial HTML even though this wrapper is a client component.
 */
export function Reveal({
  children,
  delay = 0,
  y,
  as: As = 'div',
  style,
  className,
  ...rest
}: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>()
  const done = useDelayedFlag(inView, 2400 + delay)

  return (
    <As
      ref={ref}
      className={className ? `reveal ${className}` : 'reveal'}
      data-in={inView}
      data-done={done}
      style={
        {
          '--reveal-delay': `${delay}ms`,
          ...(y != null ? { '--reveal-y': `${y}px` } : null),
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </As>
  )
}
