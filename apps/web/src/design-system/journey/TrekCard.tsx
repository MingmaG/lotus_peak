'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, type CSSProperties } from 'react'
import { Divider } from '../core/Divider'
import { altFor } from '@/lib/assets'

export type TrekCardProps = {
  image?: string
  region?: string
  title: string
  days?: string
  altitude?: string
  difficulty?: string
  /** e.g. "US$ 4,500" */
  price?: string
  excerpt?: string
  href: string
  size?: 'md' | 'lg'
  /** Kera textile rule along the top edge. Default true. */
  kera?: boolean
  style?: CSSProperties
  priority?: boolean
  /** How wide the card renders, for the srcset. Defaults to the two-column grid. */
  sizes?: string
}

/**
 * Editorial journey card: woven kera edge on top, portrait photo with a region
 * label, meta row, display title, optional price line. No borders, no shadows.
 */
export function TrekCard({
  image,
  region,
  title,
  days,
  altitude,
  difficulty,
  price,
  excerpt,
  href,
  size = 'md',
  kera = true,
  style,
  priority,
  sizes = '(max-width: 900px) 100vw, 45vw',
}: TrekCardProps) {
  const [h, setH] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onFocus={() => setH(true)}
      onBlur={() => setH(false)}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'var(--text-body)',
        fontFamily: 'var(--font-sans-body)',
        ...style,
      }}
    >
      {kera && (
        <Divider
          variant="kera"
          height={5}
          style={{
            marginBottom: 10,
            opacity: h ? 1 : 0.85,
            transition: 'opacity var(--dur-quick) var(--ease-breath)',
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          aspectRatio: size === 'lg' ? '16/10' : '4/5',
          overflow: 'hidden',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--paper-3)',
        }}
      >
        {image && (
          <Image
            src={image}
            alt={altFor(image)}
            fill
            sizes={sizes}
            priority={priority}
            style={{
              objectFit: 'cover',
              transform: h ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform var(--dur-reveal) var(--ease-drift)',
            }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--protection)' }} />
        <div
          style={{
            position: 'absolute',
            left: 20,
            bottom: 18,
            right: 20,
            color: 'var(--paper)',
            fontSize: 'var(--text-micro)',
            letterSpacing: 'var(--tracking-label)',
            textTransform: 'uppercase',
          }}
        >
          {region}
        </div>
      </div>

      <div style={{ paddingTop: 20 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 14px',
            fontSize: 'var(--text-micro)',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          {days && <span style={{ whiteSpace: 'nowrap' }}>{days}</span>}
          {altitude && <span style={{ whiteSpace: 'nowrap' }}>{altitude}</span>}
          {difficulty && <span style={{ whiteSpace: 'nowrap' }}>{difficulty}</span>}
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--weight-semibold)',
            fontSize: size === 'lg' ? '2.25rem' : '1.75rem',
            margin: '12px 0 0',
            lineHeight: 1.2,
            color: h ? 'var(--maroon)' : 'var(--ink)',
            transition: 'color var(--dur-quick) var(--ease-breath)',
          }}
        >
          {title}
        </h3>

        {excerpt && (
          <p
            style={{
              margin: '10px 0 0',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-body-size)',
              lineHeight: 1.55,
              maxWidth: '40ch',
            }}
          >
            {excerpt}
          </p>
        )}

        {price && (
          <div style={{ marginTop: 12, fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
            From <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{price}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
