import { IMG } from './assets'

/**
 * What plays behind the home page's headline.
 *
 * The hero has been one photograph since the design was approved. It can now
 * also be a film this site serves itself, or a film on YouTube. This file is
 * what assembles the three — `heroMediaFrom` is how the home page asks for
 * them, `HomeHero` draws whichever comes back, and nothing else in the app has
 * an opinion about it.
 *
 * **The choice itself is the office's now**, a row read with the rest of the
 * site's settings, so a film can be tried and put back without a deploy. What
 * stays here is everything a row cannot hold: the photograph, which is a brand
 * asset beside the ornaments and the textures rather than a sentence somebody
 * writes, and a film served from this origin, which is a file only a developer
 * can put under `public/assets`.
 *
 * Three things are deliberate:
 *
 *  - **The photograph is always configured, whichever is chosen.** It is the
 *    hero's LCP element in every case (the film lies over it and covers it
 *    once it has frames), the fallback where a film will not play, and what a
 *    visitor who has asked for less motion sees. So it is never emptied to
 *    make room for a film, and a broken or private film costs the page a
 *    moving background rather than its front door.
 *  - **Everything stays filled.** Nothing is emptied to switch, here or in the
 *    panel, so a film can be tried against the photograph and put back
 *    without anything being retyped.
 *  - **The type refuses a half-made choice.** `kind: 'youtube'` with no
 *    address, or `kind: 'film'` with no file, does not compile — which is
 *    where you want to find out, not on the deployed page. The panel refuses
 *    the same thing for the same reason; `heroMediaFrom` is where a row that
 *    got through anyway becomes the photograph.
 *
 * `HERO_MEDIA` is `image` with no film because this repo ships no footage.
 * When the office supplies some, a file under `public/assets` is still the one
 * to prefer over YouTube: it is served from this origin, so it cannot be
 * broken by a video being made private somewhere else, and it opens no
 * connection to Google. That is why a film named here wins over the row.
 */
export type HeroMediaKind = 'image' | 'film' | 'youtube'

type HeroMediaFields = {
  /** The photograph. Shown on its own, and under either film. */
  image: string
  /**
   * A looping film this site serves — an MP4 (H.264) under `public/assets`, so
   * it is on this origin rather than the panel's storage.
   */
  film: string | null
  /**
   * A film on YouTube, as any address somebody might copy: a watch link, a
   * `youtu.be` share link, an embed address. Parsed by `@lotuspeak/video`,
   * which is the only thing in this repo that reads a video URL.
   */
  youtubeUrl: string | null
  /**
   * The frame shown while either film loads. Point it at the film's own first
   * frame, or the moment playback starts is a visible jump. Null falls back to
   * the photograph, which is the honest default: one picture is fetched either
   * way, never both.
   */
  still: string | null
}

export type HeroMedia =
  | (HeroMediaFields & { kind: 'image' })
  | (HeroMediaFields & { kind: 'film'; film: string })
  | (HeroMediaFields & { kind: 'youtube'; youtubeUrl: string })

export const HERO_MEDIA: HeroMedia = {
  kind: 'image',
  image: IMG.hero,
  film: null,
  youtubeUrl: null,
  still: null,
}

/**
 * The hero's media for one render: the office's choice over this file's assets.
 *
 * Three rules, in this order.
 *
 *  - **A film under `public/assets` wins.** Only a developer can put one
 *    there, and `kind: 'film'` above is that deliberate choice; the panel has
 *    no way to express it and no business overriding it.
 *  - **Otherwise the office decides.** `youtube` with an address plays it.
 *  - **Anything else is the photograph** — including `youtube` with nothing to
 *    play. The panel refuses to save that, so what this guards is a row
 *    written before it could, or by hand: a hero that quietly loses its
 *    motion, never its front door.
 *
 * What comes back is the same union the hero has always taken, so nothing
 * downstream learns that any of it came from a row. Whether the address names
 * a playable film is still decided in one place, `@lotuspeak/video`, when
 * `HeroFilm` asks it for an id.
 */
export function heroMediaFrom(choice: {
  media: 'image' | 'youtube'
  youtubeUrl: string | null
}): HeroMedia {
  if (HERO_MEDIA.kind === 'film') return HERO_MEDIA

  const youtubeUrl = choice.youtubeUrl?.trim() || null
  if (choice.media === 'youtube' && youtubeUrl) {
    return { ...HERO_MEDIA, kind: 'youtube', youtubeUrl }
  }

  return { ...HERO_MEDIA, kind: 'image' }
}
