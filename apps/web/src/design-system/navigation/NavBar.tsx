'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { asset } from '@/lib/assets'
import { Button } from '../core/Button'
import { MenuMap } from './MenuMap'

export type NavItem = { label: string; href: string }

export type NavBarProps = {
  items: NavItem[]
  active?: string
  cta?: NavItem
  onCta?: () => void
  /** Transparent white-on-image until scrolled. Set on routes opening with a hero. */
  inverse?: boolean
  logoSrc?: string
  brand?: string
  /** Collapse items behind a Menu toggle. Default true. */
  menu?: boolean
  search?: boolean
  searchPlaceholder?: string
  /** Show the map of Bhutan beside the menu's links. Default true. */
  map?: boolean
  /**
   * Where choosing a district goes. Defaults to the panel's own call to
   * action, which is the journeys index — so the destination stays a row the
   * office edits rather than a path written into the navigation.
   */
  mapHref?: string
  /** The destinations the map's places lead to, when one has a page. */
  mapDestinations?: { name: string; path: string }[]
  /** The page being read, so the map can light the place it is about. */
  pathname?: string
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Sticky top navigation. Transparent over a hero, frosted paper once scrolled
 * or open. Default shows the wordmark, an outlined search field and a "Menu"
 * toggle that opens a paper panel listing the items in large display type.
 *
 * Publishes its measured height to --nav-h so heroes and the trip-detail
 * sticky sub-nav stay in step with it (audit B8).
 */
export function NavBar({
  items,
  active,
  cta,
  onCta,
  inverse = false,
  logoSrc = asset('logo.webp'),
  brand = 'Lotus Peak',
  menu = true,
  search = true,
  searchPlaceholder = 'Search',
  map = true,
  mapHref,
  mapDestinations,
  pathname,
}: NavBarProps) {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const fg = inverse && !scrolled && !open ? 'var(--paper)' : 'var(--ink)'
  const showMap = menu && map
  const mapTarget = mapHref ?? cta?.href ?? items[0]?.href

  // Publish the bar height. The nav itself changes height when scrolled, so
  // this is observed rather than measured once. It is the border box that is
  // watched: scrolling changes only the padding, which leaves the content box —
  // the observer's default — the same size, so --nav-h stuck at the unscrolled
  // height and the trip sub-nav hung a padding-width gap below the bar.
  useIsomorphicLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const write = () =>
      document.documentElement.style.setProperty('--nav-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    write()
    const ro = new ResizeObserver(write)
    ro.observe(el, { box: 'border-box' })
    return () => ro.disconnect()
  }, [scrolled])

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 60)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  useEffect(() => {
    if (open) {
      setShown(true)
      return
    }
    const t = setTimeout(() => setShown(false), 700)
    return () => clearTimeout(t)
  }, [open])

  /* The page under an open menu must not scroll. Without this a wheel or a
     swipe that reaches the end of the panel carries on into the page, and every
     parallax layer and reveal behind the paper keeps moving. `scrollbar-gutter:
     stable` on <html> keeps the width from jumping when the bar goes. */
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const was = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = was
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, color: fg, fontFamily: 'var(--font-sans-body)' }}>
      {menu && shown && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            background: 'rgba(255,255,255,.96)',
            backdropFilter: 'var(--blur-nav)',
            opacity: open ? 1 : 0,
            transition: 'opacity var(--dur-slow) var(--ease-breath)',
            pointerEvents: open ? 'auto' : 'none',
          }}
        />
      )}

      <div
        ref={barRef}
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: scrolled ? '14px var(--gutter)' : '22px var(--gutter)',
          background: scrolled && !open ? 'rgba(255,255,255,.85)' : 'transparent',
          backdropFilter: scrolled && !open ? 'var(--blur-nav)' : 'none',
          borderBottom: scrolled || open ? '1px solid var(--border-hairline)' : '1px solid transparent',
          transition: 'all var(--dur-slow) var(--ease-breath)',
          color: open ? 'var(--ink)' : fg,
        }}
      >
        <Link
          href="/"
          onClick={() => setOpen(false)}
          /* Classed so the very narrow breakpoint can reach it; see globals.css. */
          className="lp-nav-brand"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: 'inherit',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {logoSrc && (
            <Image
              src={logoSrc}
              alt=""
              width={198}
              height={145}
              priority
              style={{
                height: 36,
                width: 'auto',
                filter: inverse && !scrolled && !open ? 'brightness(0) invert(1)' : 'none',
                transition: 'filter var(--dur-slow) var(--ease-breath)',
              }}
            />
          )}
          <span
            className="lp-nav-wordmark"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 'var(--weight-display)',
              fontSize: '1.375rem',
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {brand}
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px,2.5vw,36px)', minWidth: 0 }}>
          {!menu && items.map((it) => <NavLink key={it.href} item={it} active={active === it.label} />)}

          {search && (
            <label
              className="lp-nav-search-wrap"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                border: '1px solid currentColor',
                borderRadius: 'var(--radius-sm)',
                width: 200,
                background: inverse && !scrolled && !open ? 'rgba(0,0,0,.18)' : 'transparent',
                backdropFilter: inverse && !scrolled && !open ? 'blur(8px)' : 'none',
              }}
            >
              <input
                placeholder={searchPlaceholder}
                aria-label="Search"
                className="lp-nav-search"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 0,
                  outline: 0,
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: 'var(--text-small)',
                }}
              />
              <span aria-hidden="true" style={{ position: 'relative', width: 14, height: 14, flexShrink: 0 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: 10,
                    height: 10,
                    border: '1.5px solid currentColor',
                    borderRadius: '50%',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    width: 6,
                    height: 1.5,
                    background: 'currentColor',
                    transform: 'rotate(45deg)',
                    transformOrigin: 'right',
                  }}
                />
              </span>
            </label>
          )}

          {menu ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 4px',
                border: 0,
                background: 'transparent',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: 'var(--text-label)',
                letterSpacing: 'var(--tracking-nav)',
                textTransform: 'uppercase',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span aria-hidden="true" style={{ display: 'grid', gap: 4, width: 18 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      height: 1.5,
                      background: 'currentColor',
                      transform: open
                        ? i === 0
                          ? 'translateY(5.5px) rotate(45deg)'
                          : i === 2
                            ? 'translateY(-5.5px) rotate(-45deg)'
                            : 'scaleX(0)'
                        : 'none',
                      transition: 'transform var(--dur-quick) var(--ease-breath)',
                    }}
                  />
                ))}
              </span>
              {open ? 'Close' : 'Menu'}
            </button>
          ) : (
            cta && (
              <Link
                href={cta.href}
                onClick={onCta}
                style={{
                  padding: '11px 20px',
                  border: '1px solid currentColor',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: 'var(--text-micro)',
                  letterSpacing: 'var(--tracking-label)',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginLeft: 8,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  textDecoration: 'none',
                }}
              >
                {cta.label}
              </Link>
            )
          )}
        </div>
      </div>

      {menu && shown && (
        <div
          role="dialog"
          aria-label="Menu"
          aria-modal="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            zIndex: 1,
            height: 'calc(100svh - 100%)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: 'var(--space-8) var(--gutter) var(--space-9)',
            color: 'var(--ink)',
            boxSizing: 'border-box',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0)' : 'translateY(-12px)',
            transition: 'opacity var(--dur-slow) var(--ease-breath), transform var(--dur-slow) var(--ease-settle)',
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          <div
            className="lp-two-col"
            style={{
              maxWidth: 'var(--container)',
              margin: '0 auto',
              display: 'grid',
              /* With the map, the links take only what they need and the map
                 takes the rest; without it, the panel is the two-column
                 arrangement it has always been. */
              gridTemplateColumns: showMap ? 'minmax(220px, auto) minmax(0, 1fr)' : '1fr auto',
              gap: 'var(--space-8) clamp(32px, 5vw, 80px)',
              alignItems: showMap ? 'start' : 'end',
            }}
          >
            <div style={{ display: 'grid', gap: 'var(--space-8)', justifyItems: 'start', alignContent: 'start' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 18 }}>
                {items.map((it, i) => (
                  <li
                    key={it.href}
                    style={{
                      opacity: open ? 1 : 0,
                      transform: open ? 'translateY(0)' : 'translateY(16px)',
                      transition: `opacity var(--dur-slow) var(--ease-breath) ${open ? i * 70 : 0}ms, transform var(--dur-slow) var(--ease-settle) ${open ? i * 70 : 0}ms`,
                    }}
                  >
                    <MenuLink item={it} active={active === it.label} onClick={() => setOpen(false)} />
                  </li>
                ))}
              </ul>
              {/* The design system's outline button, not a hand-rolled copy of
                  its resting state. It looked identical at rest and did nothing
                  under the pointer — no rising fill, no press — which is the one
                  control in the panel that a reader is most likely to try.
                  The entrance fade is the panel's, so it is restated here
                  alongside the button's own transitions rather than replacing
                  them: `style` is merged last. */}
              {cta && (
                <Button
                  variant="outline"
                  href={cta.href}
                  onClick={() => {
                    setOpen(false)
                    onCta?.()
                  }}
                  style={{
                    padding: '14px 24px',
                    fontSize: 'var(--text-label)',
                    opacity: open ? 1 : 0,
                    transition: `opacity var(--dur-slow) var(--ease-breath) ${open ? items.length * 70 : 0}ms, color var(--dur-slow) var(--ease-settle), border-color var(--dur-slow) var(--ease-settle), transform var(--dur-quick) var(--ease-breath)`,
                  }}
                >
                  {cta.label}
                </Button>
              )}
            </div>

            {showMap && (
              <div
                style={{
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity var(--dur-reveal) var(--ease-breath) ${open ? 200 : 0}ms, transform var(--dur-reveal) var(--ease-settle) ${open ? 200 : 0}ms`,
                }}
              >
                <MenuMap
                  destinations={mapDestinations}
                  current={pathname}
                  onSelect={(place) => {
                    setOpen(false)
                    const to = place.href ?? mapTarget
                    if (to) router.push(to)
                  }}
                  style={{ width: '100%', maxWidth: 820, margin: '0 auto' }}
                />
                <div
                  style={{
                    display: 'flex',
                    gap: 16,
                    paddingTop: 12,
                    borderTop: '1px solid var(--gold)',
                    maxWidth: 820,
                    margin: '0 auto',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 'var(--text-micro)',
                      fontWeight: 500,
                      letterSpacing: 'var(--tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--text-accent)',
                      lineHeight: 1.6,
                    }}
                  >
                    Eleven places
                  </span>
                  <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <span className="lp-map-hint-fine">
                      Rest the cursor on a district or a place. Drag to turn the map.
                    </span>
                    <span className="lp-map-hint-coarse">
                      Touch a district or a place. Drag across it to turn the map.
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

function MenuLink({ item, active, onClick }: { item: NavItem; active?: boolean; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <Link
      href={item.href}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-display)',
        fontWeight: 'var(--weight-display)',
        fontSize: 'var(--text-h2)',
        letterSpacing: 'var(--tracking-display)',
        color: active || h ? 'var(--maroon)' : 'var(--ink)',
        textDecoration: 'none',
        lineHeight: 1.15,
        transition: 'color var(--dur-quick) var(--ease-breath)',
      }}
    >
      {item.label}
    </Link>
  )
}

function NavLink({ item, active }: { item: NavItem; active?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <Link
      href={item.href}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        color: 'inherit',
        textDecoration: 'none',
        fontSize: 'var(--text-label)',
        letterSpacing: 'var(--tracking-nav)',
        textTransform: 'uppercase',
        opacity: h || active ? 1 : 0.75,
        paddingBottom: 6,
        transition: 'opacity var(--dur-quick) var(--ease-breath)',
      }}
    >
      {item.label}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          height: 1,
          width: h || active ? '100%' : '0%',
          transform: 'translateX(-50%)',
          background: 'var(--saffron)',
          transition: 'width var(--dur-slow) var(--ease-settle)',
        }}
      />
    </Link>
  )
}
