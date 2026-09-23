import type { ReactNode } from 'react'
import Link from 'next/link'
import { Eyebrow } from '@/design-system'
import { Parallax, Reveal } from '@/motion'
import { heroOffset } from '@/sections/shared/Section'

/**
 * The top of a detail page: a photograph, the trail back, the title and the
 * standfirst.
 *
 * The journal entry's hero, lifted out so a valley, a place, a culture piece
 * and an entry open the same way — they are the same kind of page, a long
 * read with a photograph over it, and a visitor moving between the three
 * sections should not have to relearn the layout.
 *
 * The standfirst carries `lp-standfirst`, which is the selector the
 * structured data marks `speakable`.
 */
export function ArticleHero({
  image,
  alt,
  trail,
  eyebrow,
  title,
  standfirst,
}: {
  image: string
  alt?: string
  /** The breadcrumb, above the eyebrow. The last entry is this page, so it is not a link. */
  trail: { label: string; href?: string }[]
  eyebrow: ReactNode
  title: string
  standfirst: string
}) {
  return (
    <Parallax
      src={image}
      alt={alt}
      speed={0.6}
      priority
      style={{ height: '78svh', minHeight: 520, display: 'flex', alignItems: 'flex-end', ...heroOffset }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top,rgba(31,29,26,.78),rgba(31,29,26,.12) 55%,rgba(31,29,26,.3))',
        }}
      />
      <div
        style={{
          position: 'relative',
          padding: '0 var(--gutter) var(--space-8)',
          maxWidth: 'var(--container)',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          color: 'var(--paper)',
          display: 'grid',
          gap: 24,
        }}
      >
        <Reveal>
          <nav aria-label="Breadcrumb">
            <ol
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 'var(--text-small)',
                color: 'rgba(255,255,255,.75)',
              }}
            >
              {trail.map((crumb, i) => (
                <li key={`${crumb.label}-${i}`} style={{ display: 'flex', gap: 8 }}>
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} style={{ color: 'inherit' }}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </Reveal>
        <Reveal delay={120}>
          <Eyebrow tone="inverse">{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={240}>
          <h1 style={{ fontSize: 'var(--text-display)', lineHeight: 1, maxWidth: '14ch' }}>{title}</h1>
        </Reveal>
        {standfirst && (
          <Reveal delay={520}>
            <p
              className="lp-standfirst"
              style={{
                fontSize: 'var(--text-lead)',
                lineHeight: 'var(--leading-lead)',
                maxWidth: 'var(--measure-narrow)',
                color: 'rgba(255,255,255,.85)',
              }}
            >
              {standfirst}
            </p>
          </Reveal>
        )}
      </div>
    </Parallax>
  )
}
