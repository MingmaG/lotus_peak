'use client'

import { useRouter } from 'next/navigation'
import { Button, Eyebrow } from '@/design-system'
import { Band, Reveal, type BandProps } from '@/motion'
import { useInquiry } from './SiteChrome'

/** A Band whose CTA navigates. Keeps pages server-rendered. */
export function BandLink({ href, ...band }: BandProps & { href: string }) {
  const router = useRouter()
  return <Band {...band} onCta={() => router.push(href)} />
}

/** A Band whose CTA opens the enquiry drawer, with an inverse button rather than a rule. */
export function BandInquiry({
  label = 'Begin a conversation',
  ...band
}: Omit<BandProps, 'cta' | 'onCta' | 'children'> & { label?: string }) {
  const { open } = useInquiry()
  return (
    <Band {...band}>
      <Reveal delay={840}>
        <Button variant="inverse" size="lg" onClick={() => open()}>
          {label}
        </Button>
      </Reveal>
    </Band>
  )
}

/**
 * The same closing invitation as BandInquiry, on the page's own ground instead
 * of a photograph. The home page ends here, straight onto the footer's painted
 * landscape, and a photograph above a painting was two pictures in a row.
 *
 * Transparent rather than --paper, like a Section: the page-wide ground shows
 * through, so it reads as one surface with the section above it and with the
 * sky of the painting below. A --paper fill was a flat white slab between two
 * textured ones.
 *
 * On white the eyebrow is the accent rather than saffron, and the button is
 * the filled primary — the inverse one is a white outline, which on paper is
 * nothing at all.
 */
export function PaperInquiry({
  eyebrow,
  title,
  body,
  label = 'Begin a conversation',
}: {
  eyebrow?: string
  title?: string
  body?: string
  label?: string
}) {
  const { open } = useInquiry()
  const rule = <span style={{ width: 48, borderTop: '1px solid var(--gold)' }} />

  return (
    <section
      style={{
        position: 'relative',
        padding: 'var(--space-10) var(--gutter)',
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: '0 auto',
          textAlign: 'center',
          display: 'grid',
          justifyItems: 'center',
          gap: 24,
        }}
      >
        {eyebrow && (
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 20 }}>
              {rule}
              <Eyebrow>{eyebrow}</Eyebrow>
              {rule}
            </div>
          </Reveal>
        )}
        {title && (
          <Reveal delay={240}>
            <h2 style={{ fontSize: 'var(--text-display)', maxWidth: '14ch', lineHeight: 1.02 }}>{title}</h2>
          </Reveal>
        )}
        {body && (
          <Reveal delay={480}>
            <p
              style={{
                fontSize: 'var(--text-lead)',
                lineHeight: 'var(--leading-lead)',
                maxWidth: 'var(--measure-narrow)',
                color: 'var(--text-muted)',
              }}
            >
              {body}
            </p>
          </Reveal>
        )}
        <Reveal delay={720}>
          <Button size="lg" onClick={() => open()}>
            {label}
          </Button>
        </Reveal>
      </div>
    </section>
  )
}
