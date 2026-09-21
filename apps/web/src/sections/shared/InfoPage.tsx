import type { InfoBlock, InfoSection } from '@/content/data/pages'
import { Eyebrow } from '@/design-system'
import { Reveal } from '@/motion'

/* The shape is defined beside the content it describes, so the component and
   the export script cannot disagree about what a section is. */
export type { InfoBlock, InfoSection } from '@/content/data/pages'

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
  sections,
  note,
}: {
  eyebrow: string
  title: string
  lead: string
  sections: InfoSection[]
  note?: string
}) {
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
              <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
                {section.body.map((block, j) =>
                  typeof block === 'string' ? (
                    <p
                      key={j}
                      style={{
                        margin: 0,
                        color: 'var(--text-muted)',
                        lineHeight: 'var(--leading-body)',
                        maxWidth: 'var(--measure)',
                      }}
                    >
                      {block}
                    </p>
                  ) : (
                    <ul
                      key={j}
                      style={{
                        listStyle: 'none',
                        margin: 0,
                        padding: 0,
                        display: 'grid',
                        gap: 10,
                        maxWidth: 'var(--measure)',
                      }}
                    >
                      {block.list.map((item) => (
                        <li key={item} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 14 }}>
                          <span aria-hidden="true" style={{ color: 'var(--gold)' }}>
                            ·
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
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
