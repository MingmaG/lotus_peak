/**
 * Loads Lotus Peak's real content into an empty database.
 *
 *     npm run db:seed
 *
 * The content is `prisma/seed-data/*.json`, exported once from the website's
 * TypeScript modules by `apps/web/scripts/export-seed.ts` and
 * `export-pages.ts`. Those files are the provenance record: what lotuspeak.org
 * said on the day it moved into Postgres.
 *
 * ## What it will and will not overwrite
 *
 * The catalogue — journeys, destinations, activities, seasons, culture, the
 * gallery, the reflections, the journal and the pages — is **replaced**. The
 * JSON is the record, and a seed that merged would leave an itinerary half
 * from the file and half from wherever it had drifted to.
 *
 * Everything an office owns from its first day is **left alone** once it
 * exists: the users, the navigation, the email templates' wording, the
 * company's own description. A re-seed after adding a field must not restore
 * a published password or undo a morning's rewriting.
 *
 * `npm run db:reset` is the one that throws the database away.
 *
 * ## Why `--conditions=react-server`
 *
 * This imports the application's own services rather than reimplementing
 * them — the media pipeline in particular, so a seeded photograph goes through
 * exactly the upload path an editor's does and gets the same renditions, the
 * same blur placeholder and the same EXIF stripping. Those modules carry
 * `import 'server-only'`, which throws unless Node resolves with the
 * `react-server` condition. See the `db:seed` script in package.json.
 */

import 'dotenv/config';

import { db } from '@/lib/db';
import { env } from '@/lib/env';

import { seedCatalogue } from './seed/catalogue';
import { seedCompany } from './seed/company';
import { seedJournal } from './seed/journal';
import { seedMedia } from './seed/media';
import { seedNavigation, seedPages } from './seed/pages';
import { seedOwner, seedRoles } from './seed/users';

async function main() {
  console.log('');
  console.log(`Seeding ${redact(env.databaseUrl)}`);
  console.log(`Media   ${env.storage.driver} → ${env.storage.publicUrl}`);
  console.log('');

  const roleIds = await seedRoles();
  console.log(`  roles        ${roleIds.size}`);
  await seedOwner(roleIds);

  await seedCompany();
  console.log('  company      profile, address, contacts, hours, email templates');

  /**
   * The owner is the uploader of record for the seeded photographs.
   *
   * Not null. The media library shows who put a picture there, and "nobody"
   * on 52 of them is a column that reads as broken rather than as historical.
   */
  const owner = await db.user.findFirst({
    where: { role: { slug: 'owner' } },
    orderBy: { createdAt: 'asc' },
  });

  const images = await seedMedia(owner?.id ?? null);

  await seedCatalogue(images);
  await seedJournal(images, owner?.id ?? null);
  await seedPages(images);
  await seedNavigation();

  console.log('');
  console.log('Done. `npm run media:rebuild` fills in the AVIF and JPEG renditions,');
  console.log('which the seed skips so a first run is a minute rather than ten.');
  console.log('');
}

/** Never print a password to a terminal somebody may screenshot. */
function redact(url: string): string {
  return url.replace(/\/\/([^:]+):[^@]+@/, '//$1:•••@');
}

main()
  .catch((error) => {
    console.error('\nThe seed stopped:\n', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
