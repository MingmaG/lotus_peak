import Link from 'next/link'
import Image from 'next/image'
import type { CSSProperties } from 'react'
import { asset } from '@/lib/assets'
import { SocialIcon, type SocialPlatform } from '../core/SocialIcon'

export type FooterColumn = { title: string; links: { label: string; href: string }[] }

export type FooterContact = { label: string; display: string; href: string | null }

export type FooterSocial = { platform: SocialPlatform; label: string; url: string }

export type FooterProps = {
  brand?: string
  logoSrc?: string
  /** The short introduction under the name. */
  line?: string
  columns: FooterColumn[]
  /** One printed line per entry. Empty: no address. */
  address?: string[]
  mapUrl?: string | null
  contacts?: FooterContact[]
  socials?: FooterSocial[]
  /**
   * The left of the bottom row, already filled in.
   *
   * No default. There was one for the note that sat here before, and it held
   * a telephone number — a literal invisible until the day somebody renders
   * the component without the prop, and then published after it had been
   * wrong for a year. Every word in this footer comes from the company record.
   */
  copyright: string
  /** The right of the bottom row: "Website by Trailma". */
  credit?: { label: string; name: string; url: string | null } | null
}

const FLAGS = ['--flag-blue', '--flag-white', '--flag-red', '--flag-green', '--flag-yellow']

const QUIET: CSSProperties = { color: 'var(--text-on-ground-muted)' }
const LINK: CSSProperties = { color: 'var(--paper)', textDecoration: 'none', opacity: 0.85 }

/**
 * Deep sky footer: the brand with how to reach the office under it, up to
 * three link columns, and a hairline row with the copyright and the credit.
 *
 * Every part is drawn only when it has something in it, so switching one off
 * in the admin panel and leaving it empty look the same to a visitor.
 */
export function Footer({
  brand = 'Lotus Peak',
  logoSrc = asset('logo.webp'),
  line,
  columns,
  address = [],
  mapUrl,
  contacts = [],
  socials = [],
  copyright,
  credit,
}: FooterProps) {
  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'var(--surface-ground-deep)',
        color: 'var(--text-on-ground)',
        padding: 'var(--space-10) var(--gutter) var(--space-7)',
        fontFamily: 'var(--font-sans-body)',
      }}
    >
      <div style={{ display: 'flex', height: 2, marginBottom: 'var(--space-9)', width: 120 }}>
        {FLAGS.map((c) => (
          <div key={c} style={{ flex: 1, background: `var(${c})` }} />
        ))}
      </div>

      <div
        className="lp-footer-cols"
        style={{
          display: 'grid',
          gridTemplateColumns: columns.length ? `2fr repeat(${columns.length},1fr)` : '1fr',
          gap: 'var(--space-8)',
        }}
      >
        <div className="lp-footer-brand">
          <Link
            href="/"
            aria-label={`${brand} home`}
            style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'inherit', textDecoration: 'none' }}
          >
            {logoSrc && (
              <Image
                src={logoSrc}
                alt=""
                width={198}
                height={145}
                sizes="60px"
                style={{ height: 44, width: 'auto' }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 'var(--weight-display)',
                fontSize: '2rem',
                lineHeight: 1.1,
              }}
            >
              {brand}
            </span>
          </Link>
          {line && <p style={{ ...QUIET, marginTop: 16, maxWidth: '36ch' }}>{line}</p>}

          {(address.length > 0 || contacts.length > 0) && (
            <div style={{ display: 'grid', gap: 12, marginTop: 'var(--space-6)' }}>
              {address.length > 0 && (
                <address style={{ ...QUIET, fontStyle: 'normal' }}>
                  {mapUrl ? (
                    <a href={mapUrl} target="_blank" rel="noreferrer noopener" style={LINK}>
                      <AddressLines lines={address} />
                    </a>
                  ) : (
                    <AddressLines lines={address} />
                  )}
                </address>
              )}
              {contacts.length > 0 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                  {contacts.map((c) => (
                    <li key={c.label + c.display}>
                      <span style={{ ...QUIET, fontSize: 'var(--text-small)' }}>{c.label} </span>
                      {c.href ? (
                        <a
                          href={c.href}
                          style={LINK}
                          {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                        >
                          {c.display}
                        </a>
                      ) : (
                        <span>{c.display}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {socials.length > 0 && (
            <ul
              aria-label={`${brand} elsewhere`}
              style={{ listStyle: 'none', margin: 'var(--space-6) 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}
            >
              {socials.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener me"
                    aria-label={s.label}
                    title={s.label}
                    className="lp-footer-social"
                  >
                    <SocialIcon platform={s.platform} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {columns.map((c) => (
          <div key={c.title}>
            <div
              style={{
                fontSize: 'var(--text-micro)',
                letterSpacing: 'var(--tracking-label)',
                textTransform: 'uppercase',
                color: 'var(--saffron-2)',
                marginBottom: 22,
              }}
            >
              {c.title}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
              {c.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} style={LINK}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'var(--space-9)',
          paddingTop: 24,
          borderTop: '1px solid rgba(255,255,255,.15)',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: 'var(--text-small)',
          color: 'rgba(255,255,255,.55)',
        }}
      >
        <span>{copyright}</span>
        {credit && (
          <span>
            {credit.label}{' '}
            {credit.url ? (
              <a href={credit.url} target="_blank" rel="noreferrer noopener" style={{ ...LINK, textDecoration: 'underline', textUnderlineOffset: 4, textDecorationColor: 'var(--border-on-ground)' }}>
                {credit.name}
              </a>
            ) : (
              credit.name
            )}
          </span>
        )}
      </div>
    </footer>
  )
}

function AddressLines({ lines }: { lines: string[] }) {
  return lines.map((l) => (
    <span key={l} style={{ display: 'block' }}>
      {l}
    </span>
  ))
}
