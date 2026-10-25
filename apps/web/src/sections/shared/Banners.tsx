'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Button, Eyebrow } from '@/design-system'
import type { Banner } from '@/content/types'
import { appliesTo, isRunning, useClosed, useNoticeClock } from '@/lib/notices'
import { Reveal } from '@/motion'

/**
 * The office's banners: a band above the footer, and a pop-up.
 *
 * Client components, which is unusual for content on this site and is for one
 * reason: whether a banner shows depends on the visitor's clock (see
 * `lib/notices.ts`). The words are still in the server's HTML for every banner
 * running when the page was built, so a visitor without JavaScript sees them.
 * The pop-up is the exception, and correctly — something that opens over the
 * page is behaviour, and there is no version of it without a script.
 */

const GROUND: Record<Banner['theme'], CSSProperties> = {
  paper: { background: 'var(--paper)', color: 'var(--text-body)' },
  mist: { background: 'var(--sky-wash)', color: 'var(--text-body)' },
  ink: { background: 'var(--surface-ground)', color: 'var(--text-on-ground)' },
}

function focal(image: NonNullable<Banner['image']>): string {
  return `${Math.round(image.focal[0] * 100)}% ${Math.round(image.focal[1] * 100)}%`
}

/** Eyebrow, heading, words and links — the same block in both placements. */
function Words({ banner, dark, popup, headingId }: { banner: Banner; dark: boolean; popup?: boolean; headingId?: string }) {
  /* With an address and no words for it, the whole banner is the link, and a
     button inside a link would be a link inside a link. */
  const wholeIsLink = Boolean(banner.href && !banner.linkLabel)
  return (
    <div className="lp-banner-words">
      {banner.eyebrow && <Eyebrow tone={dark ? 'inverse' : 'accent'}>{banner.eyebrow}</Eyebrow>}
      <h2
        id={headingId}
        className="lp-banner-heading"
        style={{ fontSize: popup ? 'var(--text-h3)' : 'var(--text-h2)', color: dark ? 'var(--text-on-ground)' : 'var(--ink)' }}
      >
        {banner.heading}
      </h2>
      {banner.body && (
        <div
          className="lp-prose lp-prose-compact lp-banner-body"
          style={{ color: dark ? 'var(--text-on-ground-muted)' : 'var(--text-muted)' }}
          dangerouslySetInnerHTML={{ __html: banner.body }}
        />
      )}
      {!wholeIsLink && (banner.href || (banner.secondaryHref && banner.secondaryLabel)) && (
        <div className="lp-banner-links">
          {banner.href && banner.linkLabel && (
            <Button href={banner.href} variant={dark ? 'inverse' : 'primary'} size={popup ? 'sm' : 'md'}>
              {banner.linkLabel}
            </Button>
          )}
          {banner.secondaryHref && banner.secondaryLabel && (
            <Button
              href={banner.secondaryHref}
              variant="ghost"
              size={popup ? 'sm' : 'md'}
              style={dark ? { color: 'var(--text-on-ground)' } : undefined}
            >
              {banner.secondaryLabel} →
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Wraps the whole banner in its link when the office gave an address and no words. */
function MaybeLink({ banner, children, className }: { banner: Banner; children: ReactNode; className?: string }) {
  if (!banner.href || banner.linkLabel) return <div className={className}>{children}</div>
  const label = `${banner.heading}${banner.eyebrow ? ` — ${banner.eyebrow}` : ''}`
  return /^https?:\/\//i.test(banner.href) ? (
    <a href={banner.href} className={`${className ?? ''} lp-banner-whole`} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children}
    </a>
  ) : (
    <Link href={banner.href} className={`${className ?? ''} lp-banner-whole`} aria-label={label}>
      {children}
    </Link>
  )
}

/* -------------------------------------------------------------- page end */

export function PageEndBanners({
  banners,
  pathname,
  renderedAt,
}: {
  banners: Banner[]
  pathname: string
  renderedAt: number
}) {
  const candidates = useMemo(() => banners.filter((b) => b.placement === 'page-end'), [banners])
  const now = useNoticeClock(renderedAt, candidates)
  const shown = candidates.filter((b) => appliesTo(b, pathname) && isRunning(b, now))
  if (shown.length === 0) return null

  return (
    <aside aria-label="From Lotus Peak" style={{ position: 'relative', zIndex: 1 }}>
      {shown.map((banner) => (
        <PageEndBanner key={banner.id} banner={banner} />
      ))}
    </aside>
  )
}

function PageEndBanner({ banner }: { banner: Banner }) {
  const image = banner.image
  const backdrop = banner.layout === 'backdrop' && image
  const dark = Boolean(backdrop) || banner.theme === 'ink'

  if (backdrop) {
    return (
      <MaybeLink banner={banner} className="lp-banner lp-banner-backdrop">
        <Image
          src={image.src}
          alt={image.alt ?? ''}
          aria-hidden={image.alt ? undefined : true}
          fill
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: focal(image) }}
        />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--banner-scrim)' }} />
        <Reveal className="lp-banner-container" style={{ position: 'relative' }}>
          <div style={{ maxWidth: 'var(--measure-narrow)' }}>
            <Words banner={banner} dark />
          </div>
        </Reveal>
      </MaybeLink>
    )
  }

  return (
    <MaybeLink banner={banner} className="lp-banner" >
      <div style={GROUND[banner.theme]} className="lp-banner-ground">
        <Reveal
          className={`lp-banner-container lp-banner-split${image ? '' : ' lp-banner-text-only'}`}
          data-image={image ? (banner.layout === 'image-left' ? 'left' : 'right') : undefined}
        >
          {image && (
            <div className="lp-banner-photo">
              <Image
                src={image.src}
                alt={image.alt ?? ''}
                aria-hidden={image.alt ? undefined : true}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: 'cover', objectPosition: focal(image) }}
              />
            </div>
          )}
          <Words banner={banner} dark={dark} />
        </Reveal>
      </div>
    </MaybeLink>
  )
}

/* ----------------------------------------------------------------- popup */

/**
 * How long a page is open before a pop-up may interrupt it. Long enough that
 * the visitor has started reading; a window that opens on arrival is in the
 * way of the thing they came for.
 */
const POPUP_DELAY_MS = 6_000

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * At most one pop-up per page view, and each one once per visitor.
 *
 * It counts as seen the moment it opens, not when it is closed — somebody who
 * follows its link, or simply navigates away, has seen it, and opening it
 * again on the next page would be the behaviour that makes people leave a site.
 * An edit to the banner gives it a new version and it may open once more.
 */
export function BannerPopup({
  banners,
  pathname,
  renderedAt,
  suppressed,
}: {
  banners: Banner[]
  pathname: string
  renderedAt: number
  /** True while something else is open over the page — the enquiry drawer. */
  suppressed: boolean
}) {
  const candidates = useMemo(() => banners.filter((b) => b.placement === 'popup'), [banners])
  const now = useNoticeClock(renderedAt, candidates)
  const [closed, markClosed] = useClosed()
  const [banner, setBanner] = useState<Banner | null>(null)
  const [visible, setVisible] = useState(false)

  const next = candidates.find(
    (b) => appliesTo(b, pathname) && isRunning(b, now) && closed[b.id] !== b.version,
  )

  useEffect(() => {
    if (banner || !next || suppressed) return
    const timer = setTimeout(() => {
      /* Through the hook, not straight to storage: the set in memory has to
         change too, or this same banner qualifies again the moment it closes. */
      markClosed(next.id, next.version)
      setBanner(next)
    }, POPUP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [banner, next, suppressed, markClosed])

  /* Mounted hidden, then shown on the next frame, so the entrance transitions. */
  useEffect(() => {
    if (!banner) return
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [banner])

  /**
   * Fades out, then unmounts. A timer rather than `transitionend`: under
   * reduced motion there is no transition to end, and a pop-up waiting for one
   * would sit invisible over the page with its scroll lock still on.
   */
  const close = useCallback(() => {
    setVisible(false)
    setTimeout(() => setBanner(null), CLOSE_AFTER_MS)
  }, [])

  if (!banner) return null
  return <PopupDialog banner={banner} visible={visible} onClose={close} />
}

/** Longer than the fade (`--dur-slow`), so the panel is gone before it unmounts. */
const CLOSE_AFTER_MS = 900

function PopupDialog({
  banner,
  visible,
  onClose,
}: {
  banner: Banner
  visible: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const image = banner.image
  const dark = banner.theme === 'ink'

  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('[data-popup-close]')?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
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
      restoreTo?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="lp-popup"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div aria-hidden="true" className="lp-popup-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={`lp-popup-panel${image ? ' lp-popup-has-image' : ''}`}
        style={{
          ...GROUND[banner.theme],
          transform: visible ? 'none' : 'translateY(var(--space-4))',
        }}
      >
        <button type="button" data-popup-close className="lp-popup-close" aria-label="Close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        {image && (
          <div className="lp-popup-photo">
            <Image
              src={image.src}
              alt={image.alt ?? ''}
              aria-hidden={image.alt ? undefined : true}
              fill
              sizes="(max-width: 720px) 100vw, 420px"
              style={{ objectFit: 'cover', objectPosition: focal(image) }}
            />
          </div>
        )}
        <MaybeLink banner={banner} className="lp-popup-body">
          <Words banner={banner} dark={dark} popup headingId={headingId} />
        </MaybeLink>
      </div>
    </div>
  )
}
