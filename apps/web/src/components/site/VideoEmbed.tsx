'use client'

import { useState } from 'react'

import { EMBED_ALLOW, embedUrl, parseVideoSource, thumbnailUrl, watchUrl } from '@lotuspeak/video'

import { warmVideoConnections } from '@/lib/video-warm'

/**
 * A film, as a cover image until somebody asks for it.
 *
 * A YouTube iframe is roughly half a megabyte of third-party JavaScript before
 * anybody has pressed play. `loading="lazy"` does not fix that — it moves the
 * cost to the scroll, which is the worst moment for it, and it still runs on a
 * visitor who never watches. So what renders is a still, a play button and a
 * real link to the film; the player is created on the click.
 *
 * **The façade is a real anchor.** With no JavaScript it opens the film on
 * YouTube, which is a working page rather than a dead rectangle, and a
 * middle-click or a ⌘-click does what it does anywhere else — the handler
 * stands aside for a modified click rather than swallowing it. A crawler
 * following it finds the film.
 *
 * Hovering or tabbing onto it warms the connections, so the handshakes are
 * done before the click lands. A page with six films pays nothing for the five
 * nobody watches.
 *
 * This is the component version, for a film the page knows it has. A film
 * inside a body of rich text cannot use it — there is no element for React to
 * own inside `dangerouslySetInnerHTML` — so `lib/rich-text.ts` writes the same
 * markup and `VideoFacadeScript` answers it. The two must look identical, and
 * the CSS for both lives in `.lp-prose .video-facade`.
 */
export function VideoEmbed({
  url,
  title = 'Watch the film',
  /** The office's own still. YouTube's is used when there is none. */
  poster,
  posterAlt,
}: {
  url: string
  title?: string
  poster?: string | null
  posterAlt?: string
}) {
  const [playing, setPlaying] = useState(false)

  const source = parseVideoSource(url)
  const href = watchUrl(source)
  const still = poster ?? thumbnailUrl(source)

  /* A URL that names no film renders nothing. A channel page and a playlist
     both parse to something; neither has a video in it. */
  if (!source || !href) return null

  if (playing) {
    const src = embedUrl(source)
    if (src) {
      return (
        <div className="video-facade" data-playing="true">
          <iframe
            className="video-facade-player"
            src={src}
            title={title}
            allow={EMBED_ALLOW}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )
    }
  }

  return (
    <div className="video-facade">
      <a
        className="video-facade-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onPointerEnter={() => warmVideoConnections(source)}
        onFocus={() => warmVideoConnections(source)}
        onClick={(event) => {
          /* A modified click is the visitor asking for the film on its own
             site. The façade is a link and it should behave like one. */
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          if (event.button !== 0) return
          event.preventDefault()
          setPlaying(true)
        }}
      >
        {still && (
          /* Not `next/image`: YouTube's still is on a host the optimiser is
             not configured for, and a poster from the media library is already
             sized by the time it gets here. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="video-facade-poster"
            src={still}
            alt={posterAlt ?? ''}
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
          />
        )}
        <span className="video-facade-scrim" />
        <span className="video-facade-play" aria-hidden="true" />
        <span className="lp-sr-only">{title}</span>
      </a>
    </div>
  )
}
