/**
 * Loads Where we go, Culture and the journal from `prisma/seed-data`, and
 * nothing else.
 *
 *     npm run content:sections -w @lotuspeak/admin
 *
 * `db:seed` replaces the whole catalogue from the JSON (journeys, prices,
 * pages), which is right for an empty database and wrong for one the office
 * has been editing: run against a live panel it quietly reverts every price
 * and title changed since. This touches only the three sections: each valley,
 * place, culture piece and entry in the seed data is upserted by its slug,
 * and anything not in the seed data is left exactly as it is.
 *
 * It does overwrite the words of the rows it names. Run it to publish the
 * researched content the first time, not over edits the office has made to
 * those same pages since.
 *
 * When it finishes it tells the website, so the pages change without waiting
 * for the hourly refresh.
 */

import 'dotenv/config';

import { db } from '@/lib/db';
import { revalidate } from '@/server/services/revalidate';

import { seedCulture, seedDestinations } from './seed/catalogue';
import { seedJournal } from './seed/journal';
import { seedMedia } from './seed/media';

async function main() {
  const owner = await db.user.findFirst({
    where: { role: { slug: 'owner' } },
    orderBy: { createdAt: 'asc' },
  });

  /* Photographs already in the library are found by their hash, not uploaded
     again; this only resolves each seed path to its media id. */
  const images = await seedMedia(owner?.id ?? null);
  const media = (src: string | undefined | null) => (src ? (images.get(src) ?? null) : null);

  const destinationIds = await seedDestinations(media, images);
  await seedCulture(media, destinationIds, images);
  await seedJournal(images, owner?.id ?? null);

  /**
   * The journal index's lead, if it still says what the first seed wrote.
   *
   * It described the journal as "notes from the valleys", which is what the
   * places now under Where we go were. Rewritten only where nobody has
   * changed it since; a lead the office wrote is theirs.
   */
  const OLD_LEAD = 'Notes from the valleys — what we saw, and when it is worth coming to see it.';
  const NEW_LEAD =
    'Journeys, travel guides, experiences and stories from Bhutan. Each entry is dated, so you can see how current it is.';
  await db.page.updateMany({ where: { path: '/journal', lead: OLD_LEAD }, data: { lead: NEW_LEAD } });
  await db.page.updateMany({
    where: { path: '/journal', metaDescription: OLD_LEAD },
    data: { metaDescription: NEW_LEAD },
  });

  const push = await revalidate(['destinations', 'culture', 'journal', 'pages', 'discovery']);
  console.log(push.ok ? '  website      told' : `  website      not told: ${push.detail}`);
}

main()
  .catch((error) => {
    console.error('\nThe load stopped:\n', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
