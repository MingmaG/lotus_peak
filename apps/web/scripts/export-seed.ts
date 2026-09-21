/**
 * Exports the site's content, as it stands in TypeScript, into JSON the admin
 * panel's seed reads.
 *
 * Run once, at the point the content moves into a database:
 *
 *     cd apps/web && npx tsx scripts/export-seed.ts
 *
 * ## Why an export step and not a direct import
 *
 * The seed lives in `apps/admin` and the content lives here, behind this app's
 * `@/` alias and its own `Trip`/`Post` types. The admin panel importing across
 * that boundary would give it a compile-time dependency on the website —
 * exactly the coupling the two-app split exists to avoid — and would keep
 * `src/content/data/` alive forever as a build input.
 *
 * So the data is lifted out once, into `apps/admin/prisma/seed-data/*.json`,
 * and those files become the provenance record: what lotuspeak.org said on the
 * day it moved into Postgres. After the cutover `src/content/data/` is deleted
 * and this script is the only thing that ever read it.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ACTIVITIES, CULTURE, DESTINATIONS, GALLERY, REFLECTIONS, SEASONS, SETTINGS } from '../src/content/data/site';
import { POSTS } from '../src/content/data/posts';
import { TRIPS } from '../src/content/data/trips';
import { IMG, media } from '../src/lib/assets';

const OUT = path.resolve(process.cwd(), '../admin/prisma/seed-data');

/**
 * Every photograph the content references, keyed by its public path.
 *
 * Built from `media()` rather than from a directory listing: the directory
 * holds motifs, ornaments and textures that are decorative and deliberately
 * have no media record, and seeding them would put fourteen untitled shapes
 * into the library for an editor to wonder about.
 */
function collectImages(): Record<string, { alt: string; width: number; height: number }> {
  const used = new Set<string>();

  const add = (src: string | null | undefined) => {
    if (src && src.startsWith('/assets/')) used.add(src);
  };

  for (const trip of TRIPS) {
    add(trip.heroImage);
    for (const [src] of trip.gallery) add(src);
  }
  for (const post of POSTS) {
    add(post.heroImage);
    for (const block of post.body) if (block.kind === 'image') add(block.src);
  }
  for (const destination of DESTINATIONS) add(destination.image);
  for (const activity of ACTIVITIES) add(activity.image);
  for (const season of SEASONS) add(season.image);
  for (const article of CULTURE) add(article.image);
  for (const image of GALLERY) add(image.src);

  /* The home page and the chrome reach for these directly. */
  add(IMG.dzong);
  add(IMG.courtyard);
  add(IMG.rainbow);
  add(IMG.hike);
  add(IMG.friends);
  add(IMG.dragon);

  const out: Record<string, { alt: string; width: number; height: number }> = {};
  const undescribed: string[] = [];

  for (const src of [...used].sort()) {
    const record = media(src);
    if (!record) {
      /* A photograph the content uses and `RECORDS` has never described. It
         would arrive in the library with no alt text and no dimensions, which
         is a layout shift and an accessibility failure — so it is named here
         rather than seeded silently. */
      undescribed.push(src);
      continue;
    }
    out[src] = { alt: record.alt, width: record.width, height: record.height };
  }

  if (undescribed.length > 0) {
    console.warn(
      `\n${undescribed.length} image(s) are used but have no record in src/lib/assets.ts:`,
    );
    for (const src of undescribed) console.warn(`  ${src}`);
    console.warn('They are not seeded. Add alt text and dimensions, then run again.\n');
  }

  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const files: [string, unknown][] = [
    ['images.json', collectImages()],
    ['trips.json', TRIPS],
    ['posts.json', POSTS],
    ['destinations.json', DESTINATIONS],
    ['activities.json', ACTIVITIES],
    ['seasons.json', SEASONS],
    ['culture.json', CULTURE],
    ['gallery.json', GALLERY],
    ['reflections.json', REFLECTIONS],
    ['settings.json', SETTINGS],
  ];

  for (const [name, data] of files) {
    await writeFile(path.join(OUT, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    const count = Array.isArray(data) ? data.length : Object.keys(data as object).length;
    console.log(`${name.padEnd(20)} ${count}`);
  }

  console.log(`\nWritten to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
