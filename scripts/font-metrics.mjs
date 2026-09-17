/**
 * Just enough TrueType parsing to compute metric-compatible fallback values.
 *
 * `size-adjust` has to compare like with like. OS/2's `xAvgCharWidth` averages
 * every glyph in the font, so two fonts with different glyph coverage are not
 * comparable through it — Commissioner (full Latin/Greek/Cyrillic) against
 * Arial reads 135%, which would render the fallback a third too large and make
 * the layout shift it is meant to prevent worse.
 *
 * Instead, average the advance widths of the lowercase Latin letters and the
 * space, weighted by their frequency in English prose. That is what `capsize`
 * and `next/font` mean by `xWidthAvg`, and it is measured identically for both
 * fonts here, so the ratio is meaningful.
 */
import { readFileSync } from 'node:fs'

/** Character frequencies in English prose, from @capsizecss/unpack. */
const WEIGHTS = {
  a: 0.0651738, b: 0.0124248, c: 0.0217339, d: 0.0349835, e: 0.1041442,
  f: 0.0197881, g: 0.015861, h: 0.0492888, i: 0.0558094, j: 0.0009033,
  k: 0.0050529, l: 0.033149, m: 0.0202124, n: 0.0564513, o: 0.0596302,
  p: 0.0137645, q: 0.0008606, r: 0.0497563, s: 0.051576, t: 0.0729357,
  u: 0.0225134, v: 0.0082903, w: 0.0171272, x: 0.0013692, y: 0.0145984,
  z: 0.0007836, ' ': 0.1918182,
}

function tableDirectory(buf) {
  const tables = {}
  const numTables = buf.readUInt16BE(4)
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16
    tables[buf.toString('ascii', o, o + 4)] = {
      offset: buf.readUInt32BE(o + 8),
      length: buf.readUInt32BE(o + 12),
    }
  }
  return tables
}

/** Unicode -> glyph id, via the format 4 subtable every desktop font carries. */
function charToGlyph(buf, cmapOffset) {
  const numSubtables = buf.readUInt16BE(cmapOffset + 2)
  let best = null
  for (let i = 0; i < numSubtables; i++) {
    const o = cmapOffset + 4 + i * 8
    const platform = buf.readUInt16BE(o)
    const encoding = buf.readUInt16BE(o + 2)
    const subtable = cmapOffset + buf.readUInt32BE(o + 4)
    if (buf.readUInt16BE(subtable) !== 4) continue
    // Windows Unicode BMP wins; Unicode platform is the fallback.
    if (platform === 3 && encoding === 1) best = subtable
    else if (best === null && platform === 0) best = subtable
  }
  if (best === null) throw new Error('no format 4 cmap subtable')

  const segCountX2 = buf.readUInt16BE(best + 6)
  const segCount = segCountX2 / 2
  const endsAt = best + 14
  const startsAt = endsAt + segCountX2 + 2
  const deltasAt = startsAt + segCountX2
  const rangesAt = deltasAt + segCountX2

  return (code) => {
    for (let s = 0; s < segCount; s++) {
      const end = buf.readUInt16BE(endsAt + s * 2)
      if (code > end) continue
      const start = buf.readUInt16BE(startsAt + s * 2)
      if (code < start) return 0
      const delta = buf.readInt16BE(deltasAt + s * 2)
      const rangeOffset = buf.readUInt16BE(rangesAt + s * 2)
      if (rangeOffset === 0) return (code + delta) & 0xffff
      const glyphAt = rangesAt + s * 2 + rangeOffset + (code - start) * 2
      const glyph = buf.readUInt16BE(glyphAt)
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff
    }
    return 0
  }
}

export function fontMetrics(path) {
  const buf = readFileSync(path)
  const t = tableDirectory(buf)

  const unitsPerEm = buf.readUInt16BE(t['head'].offset + 18)
  const ascent = buf.readInt16BE(t['hhea'].offset + 4)
  const descent = buf.readInt16BE(t['hhea'].offset + 6)
  const lineGap = buf.readInt16BE(t['hhea'].offset + 8)
  const numberOfHMetrics = buf.readUInt16BE(t['hhea'].offset + 34)

  const lookup = charToGlyph(buf, t['cmap'].offset)
  const advance = (glyph) => {
    // Glyphs past numberOfHMetrics all share the last advance width.
    const i = Math.min(glyph, numberOfHMetrics - 1)
    return buf.readUInt16BE(t['hmtx'].offset + i * 4)
  }

  let total = 0
  let weight = 0
  for (const [char, w] of Object.entries(WEIGHTS)) {
    const glyph = lookup(char.codePointAt(0))
    if (!glyph) continue
    total += advance(glyph) * w
    weight += w
  }

  return { unitsPerEm, ascent, descent, lineGap, xWidthAvg: total / weight }
}

/**
 * The four `@font-face` descriptors that make a fallback occupy the same space
 * as the real font, computed the way next/font computes them.
 */
export function fallbackOverrides(font, fallback) {
  const sizeAdjust =
    font.xWidthAvg / font.unitsPerEm / (fallback.xWidthAvg / fallback.unitsPerEm)
  const pct = (v) => `${((v / font.unitsPerEm / sizeAdjust) * 100).toFixed(2)}%`
  return {
    sizeAdjust: `${(sizeAdjust * 100).toFixed(2)}%`,
    ascentOverride: pct(font.ascent),
    descentOverride: pct(-font.descent),
    lineGapOverride: pct(font.lineGap),
  }
}
