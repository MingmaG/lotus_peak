'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The hero's film when it lives on YouTube.
 *
 * It exists because YouTube serves no file: the only supported way to play one
 * of their films on another site is their iframe, and an iframe cannot be
 * autoplayed, looped, silenced or cropped from markup alone. So the hero's two
 * film routes are genuinely different machinery, and this is the expensive one
 * — which is why the whole of it is arranged around never being what a visitor
 * is waiting for.
 *
 *  - **It paints nothing until YouTube reports the film playing.** The layer is
 *    transparent until then and crosses over the still beneath it at the pace
 *    of a reveal. That is the answer to the black rectangle an embed shows
 *    while it connects: the visitor never sees the player warm up, they see the
 *    photograph, and then they are watching the film.
 *  - **Nothing of YouTube's shows.** No controls, no title, no keyboard, no end
 *    screen of somebody else's journeys, and the layer takes no pointer events,
 *    so there is nothing to hover and nothing to click. It is a moving
 *    photograph, and `aria-hidden` says so.
 *  - **A visitor who asked for less motion, or for less data, pays nothing.**
 *    Both are read before the player is built, so neither fetches the API,
 *    opens a connection to Google, or is counted as a viewer of anything.
 *    `.lp-hero-embed` is `display: none` by default as the second line of the
 *    same rule.
 *
 * `@lotuspeak/video` is still what read the office's address — it is the one
 * thing in this repo that parses a video URL. This takes the id it found. The
 * façade in `components/site/VideoEmbed` is the other half of the same policy
 * and the right component for a film somebody is meant to *watch*; a hero's
 * film is scenery, so it has no play button and no sound.
 */

type YouTubePlayer = {
  playVideo: () => void
  mute: () => void
  destroy: () => void
  setPlaybackQuality: (quality: string) => void
}

type PlayerEvent = { target: YouTubePlayer; data?: number }

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      host?: string
      width?: string
      height?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: PlayerEvent) => void
        onStateChange?: (event: PlayerEvent) => void
      }
    },
  ) => YouTubePlayer
  PlayerState: { PLAYING: number; ENDED: number }
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api'

let apiPromise: Promise<YouTubeApi> | null = null

/**
 * The IFrame API, fetched at most once per document.
 *
 * YouTube insists on one global callback, so the previous one is kept and
 * called rather than replaced — a second player on the page would otherwise
 * silently never start.
 */
function loadApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise<YouTubeApi>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT as YouTubeApi)
    }
    if (!document.querySelector(`script[src="${API_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = API_SRC
      script.async = true
      document.body.append(script)
    }
  })
  return apiPromise
}

export default function HeroYouTube({ videoId }: { videoId: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection
    if (connection?.saveData) return

    let player: YouTubePlayer | null = null
    let live = true

    void loadApi().then((api) => {
      if (!live || !frame.current) return

      player = new api.Player(frame.current, {
        videoId,
        /* The no-cookie host sets nothing until the film actually plays. */
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          /* `loop` needs the film named again as a one-item playlist. A
             YouTube quirk, not a mistake. */
          loop: 1,
          playlist: videoId,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            /* Muted first, then play: an unmuted autoplay is refused by every
               browser, and refused silently. */
            event.target.mute()
            event.target.playVideo()
            /* YouTube chooses a stream from the size of the player, and the
               player is far wider than the screen because the film is cropped
               to fill it — left alone it serves 1080p to a 390px phone. So the
               ceiling is asked for against the screen instead. It remains a
               request; on a slow line YouTube serves less, which is right. */
            event.target.setPlaybackQuality(window.innerWidth >= 1024 ? 'hd1080' : 'hd720')
          },
          onStateChange: (event) => {
            if (!live) return
            if (event.data === api.PlayerState.PLAYING) setPlaying(true)
            /* The playlist above is what loops it; this is the belt for a film
               that ends anyway, on the browsers where it does. */
            if (event.data === api.PlayerState.ENDED) event.target.playVideo()
          },
        },
      })
    })

    return () => {
      live = false
      player?.destroy()
      player = null
    }
  }, [videoId])

  return (
    <div
      aria-hidden="true"
      className="lp-hero-film lp-hero-embed"
      data-playing={playing ? 'true' : 'false'}
    >
      {/* The film is 16:9 and the hero is the shape of the screen, so the frame
          is grown to whichever of the two dimensions is short and the hero's
          own `overflow: hidden` clips the rest — `object-fit: cover`, which an
          iframe does not have, written out in CSS. */}
      <div className="lp-hero-embed-crop">
        <div ref={frame} style={{ position: 'relative', width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
