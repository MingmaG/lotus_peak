'use client'

import type { CSSProperties } from 'react'
import dynamic from 'next/dynamic'

import { youtubeId } from '@lotuspeak/video'

import type { HeroMedia } from '@/lib/hero-media'

/**
 * The YouTube machinery, which is the only part of a hero film that costs
 * anything.
 *
 * A YouTube film cannot be a `<video src>` — YouTube publishes no file — so
 * playing one means their iframe and their API, and that is a hundred lines
 * and a connection to Google that a hero showing a photograph should not pay
 * for. `dynamic` inside a *client* component is a real split (the same import
 * from a Server Component is not, which is the mistake worth naming), so a
 * hero on `image` or `film` never fetches this chunk.
 */
const HeroYouTube = dynamic(() => import('./HeroYouTube'), { ssr: false })

/**
 * A film over the hero's photograph, where the home page has been given one.
 *
 * It renders inside `Parallax`'s clipped frame, above the photograph and below
 * the words, and it is the photograph's companion rather than its replacement:
 * the still underneath is still the LCP element, still `priority`, still AVIF
 * through the optimiser, and still what paints first. The film simply covers it
 * once it has frames. So a hero carrying a film costs the largest paint
 * nothing, which is the whole reason it is built this way round.
 *
 * What it does *not* do, deliberately:
 *
 *  - **It does not breathe and it does not drift.** The 8s `breathe` and the
 *    24s `mist` exist to keep a still picture alive. Footage is already alive,
 *    and a film that is also being scaled reads as a mistake.
 *  - **It does not parallax.** The transform on the photograph beneath is
 *    driven per-frame by the scroll broker; an element over it moving at a
 *    different rate would be two backgrounds rather than one. The film holds
 *    still and the picture moves under it, unseen.
 *  - **It carries nothing.** No track, no caption, no sound, no controls and
 *    no pointer events. Everything it says, the `<h1>` over it says in text —
 *    so it is `aria-hidden`, and the still keeps the description.
 *
 * `prefers-reduced-motion` gets the photograph, and pays nothing for it:
 * `.lp-hero-film` is `display: none` by default and shown only under
 * `no-preference` (the negative default is the point — a visitor who asked for
 * less motion must not be the one depending on a query being understood), and
 * a `<video>` that is not displayed is one the browser declines to fetch.
 */
export function HeroFilm({
  media,
  /** The photograph's focal point, so the film is cropped to the same spot. */
  focus,
}: {
  media: HeroMedia
  focus: string
}) {
  if (media.kind === 'youtube') {
    /* An address that names no film leaves the hero its photograph. A typo
       must not cost the front door — `@lotuspeak/video` is what decides, here
       as everywhere else in the repo. */
    const id = youtubeId(media.youtubeUrl)
    /* No focal point: an iframe has no `object-position`, so a YouTube film is
       cropped by the box `.lp-hero-embed-crop` draws — top centre, which is
       where `FOCUS` puts the photograph. Move one and move the other. */
    return id ? <HeroYouTube videoId={id} /> : null
  }

  if (media.kind !== 'film') return null

  return (
    <video
      aria-hidden="true"
      className="lp-hero-film"
      autoPlay
      muted
      loop
      playsInline
      /* `metadata`, not `auto`: the first frames are enough to start, and the
         still is what a visitor is looking at until they arrive. There is no
         `poster` for the same reason — a poster is a second full-size download
         of the picture already underneath, fetched outside the optimiser. */
      preload="metadata"
      style={{ '--hero-focus': focus } as CSSProperties}
    >
      <source src={media.film} type="video/mp4" />
    </video>
  )
}
