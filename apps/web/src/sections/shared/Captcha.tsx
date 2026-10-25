'use client'

import { useEffect, useRef } from 'react'

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** The narrowest Turnstile's `flexible` widget will draw itself. */
const FLEXIBLE_MIN = 300

/**
 * The script, once per page however many forms ask for it — the contact page
 * has its form and the drawer's. A promise of a script tag, not of content,
 * so it is safe to keep in module scope.
 */
let loading: Promise<Turnstile> | null = null

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    script.onerror = () => {
      /* Let the next form try again rather than inherit a failed load. */
      loading = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/**
 * Cloudflare Turnstile, drawn above a form's button.
 *
 * Written by hand over the script rather than with a wrapper package: the
 * whole of the API this needs is `render`, `reset` and `remove`.
 *
 * The token lands in a hidden input named `captchaToken`, inside this form,
 * so `FormData` carries it with everything else and no form has to hold it in
 * state. A token is spent by one verification whatever the answer, so the
 * form bumps `resetKey` after every attempt to get a fresh one.
 *
 * Loaded only when a form with a check is on the screen, which keeps the
 * script and its connection to Cloudflare off every other page — and keeps
 * the page prerendered, since nothing here runs on the server.
 */
export function Captcha({
  siteKey,
  resetKey,
  error,
  onChange,
}: {
  siteKey: string
  resetKey: number
  error?: string
  /** Called with `true` when there is a token to send, `false` when it lapses. */
  onChange?: (ready: boolean) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const changed = useRef(onChange)
  changed.current = onChange

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return
        widget.current = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: 'light',
          /* `flexible` fills the form but will not go under 300px, which is
             wider than the journey page's boxed form on a phone; there it
             would hang over the box's edge. `compact` is Turnstile's own
             narrow shape, 150 by 140. */
          size: container.current.clientWidth < FLEXIBLE_MIN ? 'compact' : 'flexible',
          'response-field-name': 'captchaToken',
          callback: () => changed.current?.(true),
          'expired-callback': () => changed.current?.(false),
          'error-callback': () => changed.current?.(false),
        })
      })
      .catch(() => {
        /* Blocked or offline. The form says what to do when the send is
           refused for want of a token; there is nothing to draw here. */
      })
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [siteKey])

  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      window.turnstile?.reset(widget.current)
      changed.current?.(false)
    }
  }, [resetKey])

  return (
    <div>
      {/* Turnstile's own frame is 65px high; holding the space stops the
          button below jumping down when it arrives. */}
      <div ref={container} style={{ minHeight: 65, maxWidth: '100%' }} />
      {error && (
        <div role="alert" style={{ marginTop: 8, fontSize: 'var(--text-small)', color: 'var(--maroon)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
