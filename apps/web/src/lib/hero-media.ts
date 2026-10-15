import { IMG } from './assets'

/**
 * What plays behind the home page's headline.
 *
 * The hero has been one photograph since the design was approved. It can now
 * also be a film this site serves itself, or a film on YouTube, and this is
 * the one place that says which — `HomeHero` draws whichever is named here and
 * nothing else in the app has an opinion about it.
 *
 * Three things are deliberate:
 *
 *  - **The photograph is always configured, whichever is chosen.** It is the
 *    hero's LCP element in every case (the film lies over it and covers it
 *    once it has frames), the fallback where a film will not play, and what a
 *    visitor who has asked for less motion sees. So it is never emptied to
 *    make room for a film, and a broken or private film costs the page a
 *    moving background rather than its front door.
 *  - **All three stay filled.** Switching is `kind` alone, so a film can be
 *    tried against the photograph and put back without anything being retyped.
 *  - **The type refuses a half-made choice.** `kind: 'youtube'` with no
 *    address, or `kind: 'film'` with no file, does not compile — which is
 *    where you want to find out, not on the deployed page.
 *
 * It is `image` today because the office has supplied no footage. When it
 * does, a file under `public/assets` is the one to prefer: it is served from
 * this origin, so it cannot be broken by a video being made private somewhere
 * else, and it opens no connection to Google.
 *
 * This is source rather than a row because the hero's *picture* always has
 * been — `IMG.hero` is a brand asset beside the ornaments and the textures,
 * not a sentence the office writes. The hero's *words* are already the
 * office's: `settings.strapline`. Giving the office the choice as well means a
 * `Setting` row, a field in `packages/api-contracts` and both providers — its
 * own change, in that order, and not one to make on the way past.
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
