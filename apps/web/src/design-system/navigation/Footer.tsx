import Link from 'next/link'
import Image from 'next/image'
import { asset } from '@/lib/assets'

export type FooterColumn = { title: string; links: { label: string; href: string }[] }

export type FooterProps = {
  brand?: string
  logoSrc?: string
  line?: string
  columns: FooterColumn[]
  note?: string
}

const FLAGS = ['--flag-blue', '--flag-white', '--flag-red', '--flag-green', '--flag-yellow']

/** Deep pine footer with brand line, three link columns, a hairline legal row and a short prayer-flag rule. */
export function Footer({
  brand = 'Lotus Peak',
  logoSrc = asset('logo.webp'),
  line = 'Small-group journeys in Bhutan.',
  columns,
  /**
   * No default.
   *
   * There was one, and it held a telephone number. Nothing rendered it —
   * `SiteChrome` always passes the note from the company record — which is
   * exactly what made it dangerous: a defaulted literal that is invisible
   * until the day somebody renders the component without the prop, and then
   * publishes a number that has been wrong for a year.
   */
  note,
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
        style={{ display: 'grid', gridTemplateColumns: '2fr repeat(3,1fr)', gap: 'var(--space-8)' }}
      >
        <div>
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
          <p style={{ marginTop: 16, color: 'rgba(255,255,255,.7)', maxWidth: '30ch' }}>{line}</p>
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
                  <Link href={l.href} style={{ color: 'var(--paper)', textDecoration: 'none', opacity: 0.85 }}>
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
        <span>
          © {new Date().getFullYear()} {brand}
        </span>
        <span>{note}</span>
      </div>
    </footer>
  )
}
