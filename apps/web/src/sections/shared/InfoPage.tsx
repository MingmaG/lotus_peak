import { Prose } from '@/components/site/Prose'
import { renderStoredRichText } from '@/lib/rich-text'
import { Eyebrow } from '@/design-system'
import type { PageBand } from '@/content/types'
import { Reveal } from '@/motion'

/**
 * The bands this layout can draw.
 *
 * Only `prose`, which is what a reference page is. A band of another kind
 * would need a layout this page does not have — a photograph strip in a
 * sticky-contents column reads as a mistake — so anything else is skipped, and
 * the Pages screen's other nine bands belong on a page that renders through
 * `PageBands`.
 */
type ProseBand = Extract<PageBand, { kind: 'prose' }>

/** "1. Who we are" → "who-we-are", for the contents links. */
function anchorFor(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/^\d+[.)]?\s*/, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return slug || `section-${index + 1}`
}

/**
 * The layout the two long reference pages share: travellers' information and
 * the terms.
 *
 * A sticky contents column and a single measure of prose. There is no motif and
 * no photograph — these are pages people arrive at with a question, and the
 * page-wide Dignities layer is the only art on them.
 */
export function InfoPage({
  eyebrow,
  title,
  lead,
  bands,
  note,
}: {
  eyebrow: string
  title: string
  lead: string
  bands: PageBand[]
  note?: string
}) {
  const sections = bands
    .filter((band): band is ProseBand => band.kind === 'prose')
    .map((band, index) => ({
      /* The stored fragment where there is one; a slug of the heading where
         there is not. See `anchor` on the prose band. */
      id: band.anchor ?? anchorFor(band.title ?? '', index),
      title: band.title ?? '',
      body: band.body,
    }))

  return (
    <main
      style={{
        position: 'relative',
        padding: 'var(--space-8) var(--gutter) var(--space-10)',
        maxWidth: 'var(--container)',
        margin: '0 auto',
      }}
    >
      <Reveal>
        <Eyebrow number={eyebrow}>Practical</Eyebrow>
        <h1 style={{ fontSize: 'var(--text-h1)', marginTop: 20, maxWidth: '20ch' }}>{title}</h1>
      </Reveal>

      <Reveal delay={200}>
        <p
          style={{
            marginTop: 20,
            fontSize: 'var(--text-lead)',
            lineHeight: 'var(--leading-lead)',
            maxWidth: 'var(--measure-narrow)',
            color: 'var(--text-muted)',
          }}
        >
          {lead}
        </p>
      </Reveal>

      <div
        className="lp-info"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 22%) minmax(0, 1fr)',
          gap: 'var(--space-9)',
          marginTop: 'var(--space-9)',
          alignItems: 'start',
        }}
      >
        <nav aria-label="On this page" className="lp-info-nav" style={{ position: 'sticky', top: 'calc(var(--nav-h) + 24px)' }}>
          <Eyebrow tone="muted">On this page</Eyebrow>
          <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 10 }}>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  style={{
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    fontSize: 'var(--text-small)',
                    lineHeight: 'var(--leading-body)',
                  }}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ display: 'grid', gap: 'var(--space-8)', maxWidth: 'var(--container-text)' }}>
          {sections.map((section, i) => (
            <Reveal key={section.id} delay={Math.min(i, 3) * 140} y={24} id={section.id} as="section">
              <h2
                style={{
                  fontSize: 'var(--text-h3)',
                  scrollMarginTop: 'calc(var(--nav-h) + 24px)',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--border-gold)',
                }}
              >
                {section.title}
              </h2>
              {/**
                * The body, as HTML from the restricted editor.
                *
                * It used to be an array of paragraphs and `{ list }` objects
                * mapped over here. One string is what a `prose` band holds —
                * and what an editor typing into a box produces — and the
                * `lp-info-prose` rule below gives its `<p>` and `<ul>` exactly
                * the treatment the mapped version had, including the gold
                * middot before each list item.
                */}
              <Prose
                className="lp-info-prose"
                html={renderStoredRichText(section.body)}
                style={{ marginTop: 18, maxWidth: 'var(--measure)' }}
              />
            </Reveal>
          ))}

          {note && (
            <Reveal y={24}>
              <p
                style={{
                  margin: 0,
                  paddingTop: 'var(--space-5)',
                  borderTop: '1px solid var(--border-gold)',
                  color: 'var(--text-faint)',
                  fontSize: 'var(--text-small)',
                  maxWidth: 'var(--measure)',
                }}
              >
                {note}
              </p>
            </Reveal>
          )}
        </div>
      </div>
    </main>
  )
}
