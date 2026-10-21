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
  hero: asset('hero-section-image.jpg'),
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

  /* Photographs carried over from lotuspeak.org. Every one of these was looked
     at before its `alt` was written below, and two were renamed because the
     WordPress filename named the wrong building. */
  jakarDzong: asset('imagery/jakar-dzong.webp'),
  tharpaling: asset('imagery/tharpaling.webp'),
  trongsaDzong: asset('imagery/trongsa-dzong.webp'),
  simtokhaDzong: asset('imagery/simtokha-dzong.webp'),
  thimphuDzong: asset('imagery/thimphu-dzong.webp'),
  buddhaDordenma: asset('imagery/buddha-dordenma.webp'),
  takinPreserve: asset('imagery/takin-preserve.webp'),
  kurjeyLhakhang: asset('imagery/kurjey-lhakhang.webp'),
  tamshingLhakhang: asset('imagery/tamshing-lhakhang.webp'),
  konchogsumLhakhang: asset('imagery/konchogsum-lhakhang.webp'),
  chimiLhakhang: asset('imagery/chimi-lhakhang.webp'),
  jomolhariTrek: asset('imagery/jomolhari-trek.webp'),
  chamMaskedDance: asset('imagery/cham-masked-dance.webp'),
  maskDance: asset('imagery/mask-dance.webp'),
  chamDancers: asset('imagery/cham-dancer.webp'),
  atsara: asset('imagery/alo.webp'),
  phobjikhaValley: asset('imagery/phobjikha-valley.webp'),
  gangteyGoenpa: asset('imagery/gangtey-goenpa.webp'),
  gangteyVillage: asset('imagery/gangtey-village.webp'),
  dochulaPass: asset('imagery/dochula-pass.webp'),
  paroDzong: asset('imagery/paro-dzong.jpg'),
  paroAirport: asset('imagery/paro-airport-view.webp'),
  thimphuValley: asset('imagery/thimphu-valley.jpg'),
  foggyValley: asset('imagery/foggy-valley.jpg'),
  uphill: asset('imagery/uphill.jpg'),
  archery: asset('imagery/archery.webp'),
  khuru: asset('imagery/khuru.webp'),
  meditation: asset('imagery/meditation.webp'),
  peace: asset('imagery/peace.webp'),
  jomzo: asset('imagery/lam-with-sculpture.webp'),
  zhabdrung: asset('imagery/zhabdrung.webp'),
  gelongs: asset('imagery/gelongs-walking.webp'),
  recitation: asset('imagery/reciting-gelongs.webp'),
  khadar: asset('imagery/khadar-lama.webp'),
  bellAndDrum: asset('imagery/bell-and-drum.webp'),
  thangkas: asset('imagery/thangkas.webp'),
  cuisine: asset('imagery/cuisine.webp'),
  rainbow: asset('imagery/travel-with-heart.webp'),
  courtyard: asset('imagery/guided-principle.webp'),
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
  [IMG.hero]: {
    alt: 'Taktshang, the Tiger’s Nest, on its granite cliff above a forested valley, with the path climbing to it on the left',
    width: 4032,
    height: 3024,
  },
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

  [IMG.jakarDzong]: {
    alt: 'Jakar Dzong on its ridge above the Choekhor valley, whitewashed walls and red roofs below a wall of pine forest',
    width: 680,
    height: 453,
  },
  [IMG.tharpaling]: {
    alt: 'Tharpaling Monastery built tight against a mossy cliff, gold finials above white and ochre walls, a path climbing to the door',
    width: 1360,
    height: 907,
  },
  [IMG.trongsaDzong]: {
    alt: 'Trongsa Dzong on its ridge above the Mangde Chhu, ridge behind ridge fading into blue haze',
    width: 1360,
    height: 906,
  },
  [IMG.simtokhaDzong]: {
    alt: 'Simtokha Dzong on a low ridge south of Thimphu, its utse tower rising above whitewashed walls and painted window frames',
    width: 1360,
    height: 907,
  },
  [IMG.thimphuDzong]: {
    alt: 'Tashichho Dzong across ripening rice terraces in the Thimphu valley, with Buddha Dordenma small on the far ridge',
    width: 1500,
    height: 1000,
  },
  [IMG.buddhaDordenma]: {
    alt: 'The gilded Buddha Dordenma seated above Thimphu at the head of an empty plaza, in early light',
    width: 1020,
    height: 361,
  },
  [IMG.takinPreserve]: {
    alt: 'Takin grazing among blue pines in the Motithang preserve above Thimphu',
    width: 700,
    height: 346,
  },
  [IMG.kurjeyLhakhang]: {
    alt: 'Kurjey Lhakhang in Bumthang, painted timber windows across whitewashed walls, with white chortens on the swept forecourt',
    width: 1360,
    height: 1020,
  },
  [IMG.tamshingLhakhang]: {
    alt: 'Tamshing Lhakhang above the Bumthang valley, its gold spire and yellow roof among village rooftops',
    width: 1024,
    height: 575,
  },
  [IMG.konchogsumLhakhang]: {
    alt: 'The painted facade of Könchogsum Lhakhang, gold and vermilion woodwork above a stone forecourt',
    width: 900,
    height: 502,
  },
  [IMG.chimiLhakhang]: {
    alt: 'Chimi Lhakhang on its hillock in the Punakha valley, prayer wheels set in rows into the whitewashed wall',
    width: 1360,
    height: 1020,
  },
  [IMG.jomolhariTrek]: {
    alt: 'Snow peaks above a belt of fir and blue pine, seen from the trail below Jomolhari',
    width: 612,
    height: 408,
  },
  [IMG.chamMaskedDance]: {
    alt: 'A cham dancer in a snow-lion mask and brocade, arms spread mid-turn, before a densely seated tshechu crowd',
    width: 1500,
    height: 1000,
  },
  [IMG.maskDance]: {
    alt: 'A cham dancer in a wrathful red mask and heavy brocade robe, turning mid-step in the dzong courtyard',
    width: 768,
    height: 1024,
  },
  [IMG.chamDancers]: {
    alt: 'A line of young dancers in striped ghos waiting at the edge of the dzong courtyard, the crowd banked behind them',
    width: 1500,
    height: 1000,
  },
  [IMG.atsara]: {
    alt: 'An atsara in a painted mask resting his hands on the head of a small monk during a tshechu',
    width: 683,
    height: 1024,
  },
  [IMG.phobjikhaValley]: {
    alt: 'The open floor of the Phobjikha valley, fields and scattered farmhouses below long forested ridges',
    width: 1360,
    height: 1020,
  },
  [IMG.gangteyGoenpa]: {
    alt: 'Gangtey Goenpa above its village, gold roofs and carved timber galleries under low cloud',
    width: 1360,
    height: 1020,
  },
  [IMG.gangteyVillage]: {
    alt: 'The village below Gangtey Goenpa in winter light, timber houses along the lane and the monastery on the rise',
    width: 612,
    height: 408,
  },
  [IMG.dochulaPass]: {
    alt: 'The 108 Druk Wangyal chortens ranked along the ridge at Dochula, in mist at first light',
    width: 1080,
    height: 720,
  },
  [IMG.paroDzong]: {
    alt: 'Rinpung Dzong above the Paro valley with Ta Dzong on the ridge behind it and fresh snow on the peaks',
    width: 1080,
    height: 810,
  },
  [IMG.paroAirport]: {
    alt: 'Paro airport on the valley floor, its terminal roofed in the traditional style, with the dzong on the slope above',
    width: 940,
    height: 512,
  },
  [IMG.thimphuValley]: {
    alt: 'Thimphu spread along its valley, seen through a hillside of weathered prayer flags',
    width: 1080,
    height: 710,
  },
  [IMG.foggyValley]: {
    alt: 'A valley floor under frost and morning mist, a small temple standing among bare winter fields',
    width: 612,
    height: 408,
  },
  [IMG.uphill]: {
    alt: 'A line of prayer flags and a small gold-roofed shrine on a grassy spur, snow peaks beyond',
    width: 1080,
    height: 720,
  },
  [IMG.archery]: {
    alt: 'An archer in gho at full draw with a bamboo bow, the arrow already away against a wooded ridge',
    width: 612,
    height: 408,
  },
  [IMG.khuru]: {
    alt: 'Khuru darts, weighted and flighted with folded paper, standing point-down in a wooden board',
    width: 400,
    height: 600,
  },
  [IMG.meditation]: {
    alt: 'A woman sitting cross-legged on a rock at sunrise, hands resting one in the other',
    width: 1147,
    height: 1500,
  },
  [IMG.peace]: {
    alt: 'A traveller sitting on a rock above a forested valley, watching cloud move along the ridge below',
    width: 768,
    height: 1024,
  },
  [IMG.jomzo]: {
    alt: 'A sculptor shaping a clay figure with a wooden tool while a Lam watches from behind',
    width: 810,
    height: 1080,
  },
  [IMG.zhabdrung]: {
    alt: 'An unfired clay figure of the Zhabdrung on a workshop bench, the robes still soft from the modelling',
    width: 768,
    height: 1024,
  },
  [IMG.gelongs]: {
    alt: 'Two monks in red robes crossing the painted courtyard gallery of Punakha Dzong',
    width: 612,
    height: 392,
  },
  [IMG.recitation]: {
    alt: 'Young monks seated on mats in a temple hall, reading from loose-leaf texts',
    width: 1024,
    height: 576,
  },
  [IMG.khadar]: {
    alt: 'A monk carrying a yellow khadar between tall prayer flags at a hillside ceremony',
    width: 1024,
    height: 768,
  },
  [IMG.bellAndDrum]: {
    alt: 'Singing bowls and a frame drum set out on grass among yellow flowers',
    width: 612,
    height: 408,
  },
  [IMG.thangkas]: {
    alt: 'Thangkas, tassels and folded silks hanging in a market stall, lit warm from within',
    width: 1000,
    height: 1500,
  },
  [IMG.cuisine]: {
    alt: 'A Bhutanese meal laid out in brass bowls — red rice, curries and ezay — on a restaurant table',
    width: 1500,
    height: 1000,
  },
  [IMG.rainbow]: {
    alt: 'A rainbow over the forested ridge above a Bhutanese village, cattle grazing in the foreground',
    width: 768,
    height: 1024,
  },
  [IMG.courtyard]: {
    alt: 'Two men in gho crossing a dzong courtyard towards a painted temple doorway',
    width: 408,
    height: 612,
  },
}

/* ---------------------------------------------------------------------------
   Images that came from the content API
   --------------------------------------------------------------------------- */

/**
 * Descriptions for photographs the content provider has just fetched.
 *
 * `RECORDS` above is keyed by `/assets/…` paths and was complete while the
 * photographs lived in `public/`. They live in the admin panel's media library
 * now, so a `src` reaching {@link media} is
 * `https://…/media/<id>/1600.webp` — a key `RECORDS` has never heard of — and
 * every `altFor()` in the design system would return `''`. That is not a
 * cosmetic regression: it is twenty-one pages of images announcing themselves
 * as decorative to anybody using a screen reader.
 *
 * Passing the description down instead would mean changing the signature of
 * `TrekCard`, `WindowFrame`, `Parallax`, `Strip` and four pages — the approved
 * design's own components — to carry a field they already have a way of
 * finding. So the provider registers what it fetched, and the existing lookup
 * finds it.
 *
 * ## Why a module-level map is safe here
 *
 * It is shared by every request this process handles, which is usually a bug.
 * It is not one here: the entries are immutable facts about a photograph —
 * this URL shows this, at these dimensions — keyed by a URL that contains the
 * media id. Nothing is per-visitor, two requests cannot disagree, and a stale
 * entry is impossible because replacing the file behind a photograph writes
 * new rendition keys. It is a cache of the media table, not request state.
 */
const REGISTERED = new Map<string, Omit<MediaAsset, 'src'>>()

export function registerMedia(
  src: string,
  record: { alt: string; width: number; height: number },
): void {
  if (!src) return
  REGISTERED.set(src, record)
}

/**
 * The record for a content image. Unknown paths — art that has no record yet —
 * come back with empty `alt` and no dimensions, which is the safe reading: an
 * image whose subject we cannot describe is better announced as decorative than
 * described wrongly, and a caller without dimensions uses `fill`.
 */
export function media(src: string): MediaAsset | null {
  const registered = REGISTERED.get(src)
  if (registered) return { src, ...registered }
  const record = RECORDS[src]
  return record ? { src, ...record } : null
}

/** `alt` for a content image, or '' when the image is not a described asset. */
export function altFor(src: string): string {
  return REGISTERED.get(src)?.alt ?? RECORDS[src]?.alt ?? ''
}
