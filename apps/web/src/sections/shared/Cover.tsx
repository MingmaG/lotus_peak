import type { ReactNode } from 'react'
import Link from 'next/link'
import { Eyebrow } from '@/design-system'
import { Parallax, Reveal } from '@/motion'
import { heroOffset } from './Section'

/**
 * The photograph a page opens with, and nothing else.
 *
 * Titles, trails and standfirsts used to be set over the image under a dark
 * gradient. Type on a photograph fights whatever the photograph happens to
 * contain — a white prayer flag behind a white title — and the office picks
 * these images, not the designer, so the page cannot know which ones will
 * fight. The words now sit on paper in `PageHeader` below, and the image is
 * left to be looked at.
 *
 * It still runs up under the nav (`heroOffset`), so these routes keep the
 * white-on-image nav in `SiteChrome`; `--cover-scrim` shades the top edge for
 * that and nothing more.
 */
export function CoverImage({ image, alt }: { image: string; alt?: string }) {
  return (
    <Parallax
      src={image}
      alt={alt}
      speed={0.6}
      priority
      className="lp-cover"
      style={heroOffset}
    >
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--cover-scrim)' }} />
    </Parallax>
  )
}

/**
 * The trail, eyebrow, title and standfirst, on paper, under a `CoverImage`.
 *
 * `width` follows what comes next: `text` lines the title up with a long
 * read's column, `wide` with a page of sections. The standfirst carries
 * `lp-standfirst`, which is the selector the structured data marks
 * `speakable`.
 */
export function PageHeader({
  trail,
  eyebrow,
  title,
  standfirst,
  width = 'wide',
  flush = true,
  children,
}: {
  /** The breadcrumb, above the eyebrow. The last entry is this page, so it is not a link. */
  trail?: { label: string; href?: string }[]
  eyebrow: ReactNode
  title: string
  standfirst?: ReactNode
  width?: 'text' | 'wide'
  /**
   * Whether what follows brings its own top padding, as a `Section` or an
   * article does. The trip's section nav does not, and would otherwise sit
   * against the last line of the heading.
   */
  flush?: boolean
  /** Anything that belongs to the heading rather than the page — the trip's regions. */
  children?: ReactNode
}) {
  return (
    <header style={{ padding: `var(--space-8) var(--gutter) ${flush ? '0' : 'var(--space-7)'}` }}>
      <div
        style={{
          maxWidth: width === 'text' ? 'var(--container-text)' : 'var(--container)',
          margin: '0 auto',
          display: 'grid',
          gap: 20,
        }}
      >
        {trail && trail.length > 0 && (
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
                  color: 'var(--text-muted)',
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
        )}
        <Reveal delay={120}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={240}>
          <h1 style={{ fontSize: 'var(--text-h1)', lineHeight: 1.05, maxWidth: '20ch' }}>{title}</h1>
        </Reveal>
        {standfirst && (
          <Reveal delay={400}>
            <p
              className="lp-standfirst"
              style={{
                fontSize: 'var(--text-lead)',
                lineHeight: 'var(--leading-lead)',
                maxWidth: 'var(--measure-narrow)',
                color: 'var(--text-muted)',
              }}
            >
              {standfirst}
            </p>
          </Reveal>
        )}
        {children && <Reveal delay={520}>{children}</Reveal>}
      </div>
    </header>
  )
}
