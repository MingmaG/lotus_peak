import { Prose } from '@/components/site/Prose'
import { renderStoredRichText } from '@/lib/rich-text'
import Image from 'next/image'
import { Eyebrow } from '@/design-system'
import type { PostBlock } from '@/content/types'
import { media } from '@/lib/assets'
import { Reveal } from '@/motion'

/**
 * Renders a journal entry's blocks.
 *
 * A server component: the entry is content, and only the `Reveal` wrappers
 * around each block are client code (docs/specs/03-motion-and-effects.md §5).
 * Every block type in `PostBlock` is handled here; the switch is exhaustive and
 * the compiler enforces that when a block type is added.
 */
export function PostBody({ blocks }: { blocks: PostBlock[] }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-7)' }}>
      {blocks.map((block, i) => (
        <Reveal key={i} y={24}>
          <Block block={block} />
        </Reveal>
      ))}
    </div>
  )
}

function Block({ block }: { block: PostBlock }) {
  switch (block.kind) {
    case 'heading':
      return (
        <h2
          style={{
            fontSize: 'var(--text-h3)',
            marginTop: 'var(--space-5)',
            maxWidth: 'var(--measure-narrow)',
          }}
        >
          {block.text}
        </h2>
      )

    case 'text':
      /**
       * Rendered as markup, not as a string.
       *
       * This drew `{block.body}` as the text of a `<p>`, which was right while
       * the editor could only produce a paragraph. It produces headings, lists,
       * links, photographs, tables and films now, and a body set as text shows
       * the reader `<strong>Paro</strong>` rather than the word in bold.
       */
      return (
        <Prose
          html={renderStoredRichText(block.body)}
          style={{
            maxWidth: 'var(--measure)',
            fontSize: 'var(--text-lead)',
            lineHeight: 'var(--leading-lead)',
            color: 'var(--text-muted)',
          }}
        />
      )

    case 'list':
      return (
        <ul
          style={{
            margin: 0,
            paddingLeft: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 14,
            maxWidth: 'var(--measure)',
          }}
        >
          {block.items.map((item) => (
            <li
              key={item}
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr',
                gap: 14,
                color: 'var(--text-muted)',
                lineHeight: 'var(--leading-body)',
              }}
            >
              <span aria-hidden="true" style={{ color: 'var(--gold)', lineHeight: 'var(--leading-body)' }}>
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )

    case 'quote':
      return (
        <blockquote
          style={{
            margin: 0,
            padding: '8px 0 8px var(--space-6)',
            borderLeft: '1px solid var(--border-gold)',
            maxWidth: 'var(--measure)',
            fontSize: 'var(--text-lead)',
            lineHeight: 'var(--leading-lead)',
          }}
        >
          <Prose html={renderStoredRichText(block.text)} compact />
        </blockquote>
      )

    case 'image':
      return <Figure src={block.src} alt={block.alt} ratio={block.ratio ?? '3/2'} />

    case 'facts':
      return (
        <div style={{ maxWidth: 'var(--measure)' }}>
          <Eyebrow tone="muted">{block.title}</Eyebrow>
          <dl style={{ margin: '18px 0 0', display: 'grid', gap: 0 }}>
            {block.rows.map(([label, value], i) => (
              <div
                key={`${label}-${i}`}
                className="lp-facts-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px,26%) 1fr',
                  gap: 'var(--space-5)',
                  padding: '14px 0',
                  borderTop: '1px solid var(--border-gold)',
                }}
              >
                <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
                <dd style={{ margin: 0 }}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )
  }
}

/**
 * An in-body photograph. Dimensions and `alt` come from the media record, so a
 * picture and its description cannot drift apart — an image with no record
 * renders as decorative rather than described wrongly (src/lib/assets.ts).
 */
function Figure({ src, alt, ratio }: { src: string; alt?: string; ratio: string }) {
  /* `alt` arrives on the block now; `media()` is still consulted for the
     dimensions, and as the fallback for an image the content model has no
     description for. */
  const asset = media(src)
  const description = alt ?? asset?.alt ?? ''
  return (
    <figure style={{ margin: 'var(--space-4) 0', maxWidth: 'var(--container-text)' }}>
      <div style={{ position: 'relative', aspectRatio: ratio, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <Image
          src={src}
          alt={description}
          aria-hidden={description ? undefined : true}
          fill
          sizes="(max-width: 900px) 100vw, 70vw"
          style={{ objectFit: 'cover' }}
        />
      </div>
      {description && (
        <figcaption
          style={{
            marginTop: 12,
            fontSize: 'var(--text-small)',
            color: 'var(--text-muted)',
            maxWidth: 'var(--measure-narrow)',
          }}
        >
          {description}
        </figcaption>
      )}
    </figure>
  )
}
