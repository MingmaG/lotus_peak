/**
 * Single place that knows where brand assets live.
 *
 * In the design project every path is resolved relative to the _ds_bundle.js
 * script tag. Here they are served from /public/assets, so a CDN or a CMS media
 * host only changes this function.
 */
const BASE = '/assets/'

export function asset(path: string): string {
  return BASE + path.replace(/^\/+/, '')
}

/** Imagery used across the site, matching the design project's IMG map. */
export const IMG = {
  dress: asset('imagery/traditional-dress.jpg'),
  dzong: asset('imagery/punakha-foggy-dzong.webp'),
  chorten: asset('imagery/memorial-chorten.webp'),
  taktshang: asset('imagery/taktshang.webp'),
  hike: asset('imagery/travellers-hike.webp'),
  tshechu: asset('imagery/tshechu-crowd.webp'),
  bridge: asset('imagery/punakha-dzong-bridge.webp'),
  tashichho: asset('imagery/tashichho-dzong.jpg'),
  dragon: asset('illustrations/druk-dragon-mural.jpg'),
  friends: asset('illustrations/four-harmonious-friends.jpg'),
  kera: asset('textures/kera-full.jpg'),
  springImg: asset('imagery/season-spring.jpg'),
  summerImg: asset('imagery/season-summer.jpg'),
  autumnImg: asset('imagery/season-autumn.jpg'),
  winterImg: asset('imagery/season-winter.jpg'),
} as const

/* ---------------------------------------------------------------------------
   Media records
   --------------------------------------------------------------------------- */

/**
 * `MediaAsset` as specified in docs/specs/04-content-model.md, for the photographs
 * that ship with the design. `width`/`height` are measured from the files on disk
 * — next/image needs them and CLS depends on them — and `alt` is written from the
 * photograph rather than from the filename.
 *
 * Only content images are here. Motifs, the Dignities layer, the window ornaments,
 * the mask icons and the logo are decorative: they carry `alt=""` and `aria-hidden`
 * at their one call site and are deliberately absent, exactly as §MediaAsset says.
 *
 * When a CMS becomes the content source these records come from it, and `media()`
 * becomes a repository lookup. The shape is already the one the providers must map
 * into, so nothing above this function changes.
 */
export type MediaAsset = {
  src: string
  alt: string
  width: number
  height: number
}

const RECORDS: Record<string, Omit<MediaAsset, 'src'>> = {
  [IMG.taktshang]: {
    alt: 'Taktshang monastery on the granite cliff above the Paro valley, white walls and red roofs among pine forest',
    width: 1024,
    height: 683,
  },
  [IMG.dzong]: {
    alt: 'Punakha Dzong at first light, its gold-tipped roofs above a valley filled with mist',
    width: 1024,
    height: 683,
  },
  [IMG.bridge]: {
    alt: 'The roofed cantilever bridge over the Mo Chhu, with the towers of Punakha Dzong behind it',
    width: 1920,
    height: 1440,
  },
  [IMG.chorten]: {
    alt: 'The National Memorial Chorten in Thimphu, white with a gold spire, below forested ridges',
    width: 1024,
    height: 585,
  },
  [IMG.tashichho]: {
    alt: 'Tashichho Dzong in Thimphu, its whitewashed length and gold-roofed towers below a wooded hillside',
    width: 2400,
    height: 1229,
  },
  [IMG.hike]: {
    alt: 'Four travellers walking up a grassy ridge with poles, a monastery in the mist in the valley below',
    width: 810,
    height: 840,
  },
  [IMG.tshechu]: {
    alt: 'A tshechu crowd seated close together in gho and kira, watching the dances',
    width: 612,
    height: 408,
  },
  [IMG.dress]: {
    alt: 'Two boys in gho, and three girls in kira standing before a row of prayer wheels',
    width: 735,
    height: 490,
  },
  [IMG.kera]: {
    alt: 'A kera, the woven belt that fastens the kira, its plain orange ground giving way to bands of pattern',
    width: 1500,
    height: 1000,
  },
  [IMG.dragon]: {
    alt: 'A druk, the thunder dragon, painted in blue and coral on a monastery wall',
    width: 480,
    height: 639,
  },
  [IMG.friends]: {
    alt: 'The four harmonious friends: bird, hare, monkey and elephant standing one upon the other beneath a fruiting tree',
    width: 342,
    height: 500,
  },
  [IMG.springImg]: {
    alt: 'A whitewashed prayer tower on a green hillside, with ridge behind ridge into the distance',
    width: 500,
    height: 281,
  },
  [IMG.summerImg]: {
    alt: 'Punakha Dzong between its two rivers in summer, the valley green under heavy cloud',
    width: 500,
    height: 282,
  },
  [IMG.autumnImg]: {
    alt: 'A dzong above the river in autumn, with turning trees and dry stone banks',
    width: 500,
    height: 281,
  },
  [IMG.winterImg]: {
    alt: 'Paro Dzong on the valley floor beneath snow-covered peaks in clear winter air',
    width: 500,
    height: 333,
  },
}

/**
 * The record for a content image. Unknown paths — a CMS image, or art that has
 * no record yet — come back with empty `alt` and no dimensions, which is the
 * safe reading: an image whose subject we cannot describe is better announced as
 * decorative than described wrongly, and a caller without dimensions uses `fill`.
 */
export function media(src: string): MediaAsset | null {
  const record = RECORDS[src]
  return record ? { src, ...record } : null
}

/** `alt` for a content image, or '' when the image is not a described asset. */
export function altFor(src: string): string {
  return RECORDS[src]?.alt ?? ''
}
