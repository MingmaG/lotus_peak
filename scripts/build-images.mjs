/**
 * Copies the brand imagery from the design export into public/assets, doing the
 * source-level processing from docs/specs/02-design-system.md §4.
 *
 *   node scripts/build-images.mjs
 *
 * This is not the responsive ladder — next/image builds that per request from
 * whatever lands here, at the widths in next.config.mjs. This script only fixes
 * the two things next/image cannot:
 *
 *   1. Originals wider than the largest `deviceSize`. Those pixels can never
 *      reach a browser; they only make the optimiser decode more on a cold
 *      cache. tashichho-dzong.jpg arrives 3639 px wide and 4.1 MB.
 *   2. Files the optimiser never sees at all, because they are referenced from
 *      CSS rather than from an <img> — textures/kera-strip.png is a repeating
 *      `background-image` in Divider, and icons/*.png are `mask-image` in
 *      SiteIcon. Whatever is on disk is what ships.
 *
 * Everything else is copied byte for byte. Re-encoding an image that is already
 * small enough only loses generations.
 */
import { readdirSync, mkdirSync, copyFileSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import sharp from 'sharp'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'design-source', 'assets')
const OUT = join(ROOT, 'public', 'assets')

/** The largest width next/image will ever request — next.config.mjs deviceSizes. */
const MAX_WIDTH = 2400

/** A palette rewrite has to beat the original by this much to be worth it. */
const WORTH_IT = 0.85

const kb = (n) => `${(n / 1024).toFixed(0)} KB`

async function capWidth(from, to) {
  const image = sharp(from)
  const { width, format } = await image.metadata()
  if (!width || width <= MAX_WIDTH) return null

  const resized = image.resize({ width: MAX_WIDTH, withoutEnlargement: true })
  const encoded =
    format === 'jpeg'
      ? resized.jpeg({ quality: 82, mozjpeg: true })
      : format === 'webp'
        ? resized.webp({ quality: 82 })
        : resized.png({ compressionLevel: 9 })

  await encoded.toFile(to)
  const after = await sharp(to).metadata()
  return { width, to: after.width, from: statSync(from).size, size: statSync(to).size }
}

async function palette(from, to) {
  const buf = await sharp(from).png({ palette: true, quality: 90, effort: 10 }).toBuffer()
  const before = statSync(from).size
  if (buf.length > before * WORTH_IT) return null
  await sharp(buf).toFile(to)
  return { from: before, size: buf.length }
}

/** Referenced from CSS, so next/image never gets a chance to shrink them. */
const CSS_REFERENCED = new Set(['textures', 'icons'])

let copied = 0
const changes = []

for (const dir of readdirSync(SRC)) {
  const dirPath = join(SRC, dir)
  if (!statSync(dirPath).isDirectory()) {
    // logo.webp and anything else sitting at the root of the export.
    copyFileSync(dirPath, join(OUT, dir))
    copied++
    continue
  }
  if (dir === 'fonts') continue // scripts/build-fonts.mjs owns these

  mkdirSync(join(OUT, dir), { recursive: true })

  for (const file of readdirSync(dirPath)) {
    const from = join(dirPath, file)
    const to = join(OUT, dir, file)

    let result = null
    if (dir === 'imagery' || dir === 'illustrations' || dir === 'ornaments') {
      result = await capWidth(from, to)
      if (result) {
        changes.push(
          `  ${dir}/${file}\n      ${result.width}px ${kb(result.from)} -> ${result.to}px ${kb(result.size)}`,
        )
        continue
      }
    } else if (CSS_REFERENCED.has(dir) && extname(file) === '.png') {
      result = await palette(from, to)
      if (result) {
        changes.push(`  ${dir}/${file}\n      ${kb(result.from)} -> ${kb(result.size)} (palette)`)
        continue
      }
    }

    copyFileSync(from, to)
    copied++
  }
}

if (!existsSync(OUT)) throw new Error(`${OUT} missing`)

console.log(changes.length ? `\n  Processed:\n${changes.join('\n')}` : '\n  Nothing needed processing.')
console.log(`\n  ${copied} files copied unchanged.`)
console.log(`\n  Dimensions changed? Update src/lib/assets.ts and run pnpm assets:check.\n`)
