import { Prose } from '@/components/site/Prose'
import { Reveal } from '@/motion'

/**
 * Renders a journal entry.
 *
 * It used to take an array of typed blocks and draw each kind as its own React
 * element — a `facts` block as a definition list, a `quote` as a Reflection, a
 * `text` block as a paragraph. The body is one rich-text document now, so this
 * is `Prose`, which is the component every other long-form field on this site
 * has always gone through: a journey's overview, an itinerary day, an answer
 * under a question, a page band.
 *
 * **The HTML arriving here is already sanitised.** `toPost` in
 * `content/providers/api/mappers.ts` runs `renderStoredRichText` over the
 * body, which rebuilds it from an allowlist and refuses an image whose host is
 * not the media store. Sanitising it a second time here would be worse than
 * redundant — the film façades that pass carry `data-video-facade`, the
 * allowlist gives `div` no attributes, and a second pass would quietly strip
 * the hook the player script looks for and leave every film on the page as a
 * still that does nothing.
 *
 * A server component. The only client code is the `Reveal` that brings the
 * article in (docs/specs/03-motion-and-effects.md §5).
 */
export function PostBody({ html }: { html: string }) {
  if (!html) return null

  return (
    <Reveal y={24}>
      <Prose
        html={html}
        className="lp-journal"
        style={{
          maxWidth: 'var(--measure)',
          fontSize: 'var(--text-lead)',
          lineHeight: 'var(--leading-lead)',
          color: 'var(--text-muted)',
        }}
      />
    </Reveal>
  )
}
