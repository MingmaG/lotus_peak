/**
 * Builds the rendition formats the seed skipped.
 *
 *     npm run media:rebuild            every photograph, missing formats only
 *     npm run media:rebuild -- --all   every photograph, every format, again
 *
 * The seed writes WebP only, because AVIF is several times slower to encode
 * and 52 photographs at five widths in three formats is a ten-minute wait
 * before anybody can open the panel. This fills in the rest, and it is safe to
 * run while somebody is using it: it reads the original back out of storage,
 * writes new objects under keys nothing is serving yet, and upserts the rows
 * at the end.
 */

import 'dotenv/config';

import { RENDITION_FORMATS, type RenditionFormat, widthsFor } from '@lotuspeak/media';

import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { buildRenditions } from '@/server/services/media';

async function main() {
  const rebuildAll = process.argv.includes('--all');

  const images = await db.media.findMany({
    where: { kind: 'IMAGE', deletedAt: null },
    include: { renditions: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`${images.length} photograph(s)\n`);

  let built = 0;
  let skipped = 0;

  for (const image of images) {
    if (!image.width) {
      console.warn(`  ${image.filename}: no dimensions, skipped`);
      skipped += 1;
      continue;
    }

    const wanted = widthsFor(image.width).length * RENDITION_FORMATS.length;
    if (!rebuildAll && image.renditions.length >= wanted) {
      skipped += 1;
      continue;
    }

    const source = await storage.get(image.storageKey);
    if (!source) {
      console.warn(`  ${image.filename}: the original is not in storage, skipped`);
      skipped += 1;
      continue;
    }

    /* Only the formats that are actually missing, unless --all. Re-encoding
       AVIF that is already there is the slowest possible no-op. */
    const present = new Set(image.renditions.map((r) => r.format));
    const formats: RenditionFormat[] = rebuildAll
      ? [...RENDITION_FORMATS]
      : RENDITION_FORMATS.filter((format) => !present.has(format));

    if (formats.length === 0) {
      skipped += 1;
      continue;
    }

    process.stdout.write(`  ${image.filename} → ${formats.join(', ')} … `);
    const rows = await buildRenditions(image.id, source, image.width, formats);
    console.log(`${rows.length}`);
    built += rows.length;
  }

  console.log(`\n${built} rendition(s) built, ${skipped} photograph(s) already complete.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
