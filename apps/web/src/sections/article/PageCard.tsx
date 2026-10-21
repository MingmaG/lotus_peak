import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Eyebrow } from '@/design-system'

/**
 * A link to another page, as a photograph and a few lines.
 *
 * The journal index's card, shared: a place on its valley's page, a culture
 * piece on the Culture index, an entry on a place's page. One card for all
 * three is what makes the cross-links read as one site rather than three.
 */
export function PageCard({
  href,
  image,
  alt,
  eyebrow,
  title,
  text,
  lead = false,
  priority = false,
}: {
  href: string
  image: string
  alt?: string
  eyebrow?: ReactNode
  title: string
  text?: string
  /** The wide, two-column version, for the first card on an index. */
  lead?: boolean
  priority?: boolean
}) {
  return (
    <Link
      href={href}
      className={lead ? 'lp-two-col' : undefined}
      style={{
        display: lead ? 'grid' : 'block',
        gridTemplateColumns: lead ? '1.1fr 1fr' : undefined,
        gap: lead ? 'var(--space-8)' : undefined,
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: lead ? '16/10' : '3/2',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--paper-2)',
        }}
      >
        {image && (
          <Image
            src={image}
            alt={alt ?? ''}
            fill
            sizes={lead ? '(max-width: 900px) 100vw, 55vw' : '(max-width: 900px) 100vw, 33vw'}
            style={{ objectFit: 'cover' }}
            priority={priority}
            {...(alt ? {} : { 'aria-hidden': true })}
          />
        )}
      </div>

      <div style={{ marginTop: lead ? 0 : 24 }}>
        {eyebrow && <Eyebrow tone="muted">{eyebrow}</Eyebrow>}
        <h3
          style={{
            fontSize: lead ? 'var(--text-h2)' : 'var(--text-h3)',
            marginTop: eyebrow ? 16 : 0,
            maxWidth: '18ch',
          }}
        >
          {title}
        </h3>
        {text && (
          <p
            style={{
              marginTop: 14,
              color: 'var(--text-muted)',
              maxWidth: 'var(--measure-narrow)',
              lineHeight: 'var(--leading-body)',
            }}
          >
            {text}
          </p>
        )}
      </div>
    </Link>
  )
}
