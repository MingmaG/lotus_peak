/**
 * Builds the web fonts: TTF masters -> subsetted WOFF2.
 *
 *   node scripts/build-fonts.mjs
 *
 * Input  design-source/assets/fonts/Commissioner-*.ttf   (the design project's export)
 * Output public/assets/fonts/Commissioner-*-{latin,latin-ext}.woff2
 *
 * Reading design-source here does not make it a build input in the sense of
 * CLAUDE.md §3 — `next build` never touches it, and nothing under app/ or src/
 * imports it. This is the "processing on import" step of
 * docs/specs/02-design-system.md §4, run by hand when the design project
 * re-exports its fonts. public/assets/fonts is entirely derived.
 *
 * Two subsets per weight, matching the Google Fonts split. Commissioner ships
 * Latin, Latin-Ext, Greek, Cyrillic and Vietnamese; the site is British English
 * with Latin-transliterated Dzongkha, so Greek/Cyrillic/Vietnamese are dropped
 * outright and Latin-Ext is split off behind a `unicode-range` so it is only
 * fetched if a page (or a CMS editor) actually uses one of its characters.
 *
 * Subsetting by range rather than by the characters currently in content/ is
 * deliberate: copy comes from a CMS, so the glyph set cannot be pinned to
 * today's seed data.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import subsetFont from 'subset-font'
import { fontMetrics, fallbackOverrides } from './font-metrics.mjs'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'design-source', 'assets', 'fonts')
const OUT = join(ROOT, 'public', 'assets', 'fonts')

/** The Google Fonts `latin` and `latin-ext` ranges, verbatim. */
export const RANGES = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
    'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,' +
    'U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,' +
    'U+A720-A7FF',
}

/** subset-font takes characters, not ranges, so expand each range into a string. */
function expand(range) {
  let out = ''
  for (const part of range.split(',')) {
    const [from, to] = part.replace(/U\+/g, '').split('-')
    const start = parseInt(from, 16)
    const end = to ? parseInt(to, 16) : start
    for (let c = start; c <= end; c++) {
      // Lone surrogates and the BOM cannot appear in a JS string sensibly.
      if (c >= 0xd800 && c <= 0xdfff) continue
      out += String.fromCodePoint(c)
    }
  }
  return out
}

mkdirSync(OUT, { recursive: true })

const ttfs = readdirSync(SRC).filter((f) => f.endsWith('.ttf')).sort()
if (!ttfs.length) {
  console.error(`  No TTFs in ${SRC}`)
  process.exit(1)
}

let before = 0
let after = 0

for (const file of ttfs) {
  const buf = readFileSync(join(SRC, file))
  before += buf.length
  const base = file.replace(/\.ttf$/, '')

  for (const [name, range] of Object.entries(RANGES)) {
    const out = await subsetFont(buf, expand(range), { targetFormat: 'woff2' })
    const target = join(OUT, `${base}-${name}.woff2`)
    writeFileSync(target, out)
    after += out.length
    console.log(
      `  ${base}-${name}.woff2`.padEnd(48),
      `${(out.length / 1024).toFixed(1)} KB`.padStart(9),
    )
  }
}

const stale = readdirSync(OUT).filter((f) => f.endsWith('.ttf'))
if (stale.length) {
  console.log(`\n  ${stale.length} TTFs still in public/assets/fonts — delete them, nothing references them.`)
}


/*
 * Fallback overrides, measured against the real Arial on this machine rather
 * than a published table, so both fonts are measured the same way.
 */
const ARIAL = process.platform === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : null
if (ARIAL && existsSync(ARIAL)) {
  const o = fallbackOverrides(
    fontMetrics(join(SRC, 'Commissioner-Regular.ttf')),
    fontMetrics(ARIAL),
  )
  console.log(`\n  Fallback face descriptors for fonts.css — recompute if the masters change:`)
  console.log(`    size-adjust: ${o.sizeAdjust}`)
  console.log(`    ascent-override: ${o.ascentOverride}`)
  console.log(`    descent-override: ${o.descentOverride}`)
  console.log(`    line-gap-override: ${o.lineGapOverride}`)
} else {
  console.log(`\n  Arial not found — fallback descriptors in fonts.css left unchanged.`)
}
