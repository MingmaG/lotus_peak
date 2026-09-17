/**
 * Reports which brand assets are still being served by the placeholder route.
 *
 * Run after exporting from the design project:  node scripts/check-assets.mjs
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'public', 'assets')

const EXPECTED = {
  root: ['logo.webp'],
  // Built by scripts/build-fonts.mjs from the TTF masters in design-source.
  fonts: [
    'Commissioner-Thin-latin.woff2',
    'Commissioner-Thin-latin-ext.woff2',
    'Commissioner-ExtraLight-latin.woff2',
    'Commissioner-ExtraLight-latin-ext.woff2',
    'Commissioner-Regular-latin.woff2',
    'Commissioner-Regular-latin-ext.woff2',
    'Commissioner-Medium-latin.woff2',
    'Commissioner-Medium-latin-ext.woff2',
    'Commissioner-SemiBold-latin.woff2',
    'Commissioner-SemiBold-latin-ext.woff2',
    'Commissioner-Bold-latin.woff2',
    'Commissioner-Bold-latin-ext.woff2',
    'Commissioner-ExtraBold-latin.woff2',
    'Commissioner-ExtraBold-latin-ext.woff2',
    'Commissioner-Black-latin.woff2',
    'Commissioner-Black-latin-ext.woff2',
  ],
  icons: ['buddha.png', 'chorten.png', 'dzong.png', 'dzong-long.png', 'monastery.png', 'pavilion.png', 'stupa.png'],
  illustrations: [
    'bhutan-dragon.jpg',
    'druk-dragon-mural.jpg',
    'four-animals.jpg',
    'four-harmonious-friends.jpg',
    'harmonious-friends-thangka.jpg',
    'dignity-tiger.png',
    'dignity-snow-lion.png',
    'dignity-garuda.png',
    'dignity-dragon.jpg',
  ],
  imagery: [
    'taktshang.webp',
    'punakha-foggy-dzong.webp',
    'punakha-dzong-bridge.webp',
    'memorial-chorten.webp',
    'travellers-hike.webp',
    'tshechu-crowd.webp',
    'tashichho-dzong.jpg',
    'traditional-dress.jpg',
    'season-spring.jpg',
    'season-summer.jpg',
    'season-autumn.jpg',
    'season-winter.jpg',
  ],
  ornaments: ['window-cornice.png', 'window-base.png'],
  textures: ['kera-strip.png', 'kera-full.jpg'],
}

let missing = 0
let present = 0

for (const [dir, files] of Object.entries(EXPECTED)) {
  const rows = []
  for (const file of files) {
    const path = dir === 'root' ? join(ROOT, file) : join(ROOT, dir, file)
    const ok = existsSync(path)
    ok ? present++ : missing++
    if (!ok) rows.push(file)
  }
  if (rows.length) {
    console.log(`\n  ${dir}/ — ${rows.length} missing`)
    for (const r of rows) console.log(`    · ${r}`)
  }
}

console.log(`\n  ${present} present, ${missing} missing.`)
if (missing > 0) {
  console.log(
    `\n  Export the missing files from the design project into public/assets/, preserving\n` +
      `  these paths — see docs/specs/02-design-system.md §4. Fonts are not exported\n` +
      `  directly: drop the TTF masters into design-source/assets/fonts and run\n` +
      `  pnpm fonts:build, which writes the subsetted WOFF2 this list expects.\n`,
  )
  process.exitCode = 1
} else {
  console.log(`\n  All assets present.\n`)
}
