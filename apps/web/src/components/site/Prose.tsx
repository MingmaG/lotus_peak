import { VideoFacadeScript } from './VideoFacadeScript'

/**
 * Long-form body copy.
 *
 * Every field the office writes in the admin panel's rich-text editor is drawn
 * by this: a journal entry, a journey's opening, an itinerary day, an answer
 * under a question, a page band. It takes HTML and sets it as inner HTML,
 * which is only acceptable because of what must have happened to the string
 * first.
 *
 * **What it takes is already safe.** The caller passes the output of
 * `renderRichText` or `renderStoredRichText` from `src/lib/rich-text.ts`,
 * which rebuilds the body from an allowlist of the elements a body may
 * contain and refuses an image whose host is not the media store. That runs on
 * the server. Handing this component a string from anywhere else — straight
 * from the API, straight from a column — is the one way to misuse it, and it
 * is why both of those functions are `server-only`.
 *
 * The styling is `.lp-prose` in `app/globals.css`, which reaches the elements
 * by name. It is the website's typography, not the editor's: the two agree on
 * *structure* — three heading levels, one table shape — and disagree about
 * everything else, which is correct. The editor is a workplace and this is a
 * page somebody reads slowly.
 *
 * `compact` is for a body inside something that already sets its own type — an
 * itinerary day, an answer under a question. There the block around it owns the
 * size and the colour, and what this component is for is the rest: the list,
 * the link, the bold word, the paragraph break. Without it a day's description
 * arrives in the lead type of an article.
 */
export function Prose({
  html,
  className,
  compact = false,
  style,
}: {
  html: string
  className?: string
  /** Takes its type from whatever it sits in. See the note above. */
  compact?: boolean
  style?: React.CSSProperties
}) {
  if (!html) return null

  return (
    <>
      <div
        className={['lp-prose', compact ? 'lp-prose-compact' : '', className]
          .filter(Boolean)
          .join(' ')}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* Mounted only for a body that actually contains a film, so prose with
          none in it ships no JavaScript for films. */}
      {html.includes('data-video-facade') && <VideoFacadeScript />}
    </>
  )
}
