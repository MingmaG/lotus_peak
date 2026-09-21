'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export type InquiryDrawerProps = {
  open: boolean
  onClose: () => void
  title?: string
  intro?: string
  children?: ReactNode
  footer?: ReactNode
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Right-side inquiry drawer with a gold hairline edge. Conversation-first
 * booking; slides in on --ease-settle.
 *
 * The design project's version has role="dialog" but none of the behaviour:
 * this adds the focus trap, focus restore, Escape, and the body scroll lock.
 */
export function InquiryDrawer({
  open,
  onClose,
  title = 'Begin a conversation',
  intro = 'Tell us a little. A person, not a form, will reply within two days.',
  children,
  footer,
}: InquiryDrawerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreTo.current = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      restoreTo.current?.focus()
    }
  }, [open, onClose])

  return (
    <div
      aria-hidden={!open}
      /**
       * `inert`, as a boolean, because React 19 renders it as one.
       *
       * This was `{...(!open ? { inert: '' as unknown as boolean } : null)}` —
       * the React 18 workaround from before the prop was typed. React 19 reads
       * an empty string as *false* and drops the attribute, so the closed
       * drawer was not inert at all: seven fields sat in the tab order behind
       * every page, inside a container marked `aria-hidden`. Tabbing past the
       * footer landed in an invisible enquiry form.
       */
      inert={!open}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: open ? 'auto' : 'none',
        /**
         * The closed drawer sits at `translateX(102%)` — off the right-hand
         * edge — and a fixed element that overflows to the right still widens
         * the document in Chrome. On a 390px phone that was 15px of sideways
         * scroll on every journey page, with nothing visible to explain it.
         *
         * `clip` rather than `hidden`: `hidden` makes this a scroll container,
         * which changes what `position: fixed` inside it resolves against.
         */
        overflowX: 'clip',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(31,29,26,.35)',
          opacity: open ? 1 : 0,
          transition: 'opacity var(--dur-slow) var(--ease-breath)',
        }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 520,
          maxWidth: '92vw',
          background: 'var(--paper)',
          borderLeft: '1px solid var(--gold)',
          transform: open ? 'translateX(0)' : 'translateX(102%)',
          transition: 'transform var(--dur-slow) var(--ease-settle)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-sans-body)',
          boxShadow: 'var(--shadow-lift)',
        }}
      >
        <div
          style={{
            padding: '48px 48px 28px',
            borderBottom: '1px solid var(--border-hairline)',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 40,
              right: 40,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid var(--border-hairline)',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <span
            style={{
              fontSize: 'var(--text-label)',
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--text-accent)',
              fontWeight: 500,
            }}
          >
            Plan your journey
          </span>
          <h2 style={{ fontFamily: 'var(--font-serif-display)', fontSize: '2.25rem', margin: '14px 0 0', lineHeight: 1.1 }}>
            {title}
          </h2>
          <p style={{ margin: '14px 0 0', color: 'var(--text-muted)', maxWidth: '38ch' }}>{intro}</p>
        </div>

        <div
          style={{
            padding: '36px 48px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: 1,
            display: 'grid',
            gap: 32,
            alignContent: 'start',
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: '24px 48px',
              borderTop: '1px solid var(--border-hairline)',
              fontSize: 'var(--text-small)',
              color: 'var(--text-muted)',
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </div>
  )
}
