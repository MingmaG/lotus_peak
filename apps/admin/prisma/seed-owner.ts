/**
 * Sets the owner's sign-in, and touches nothing else.
 *
 *     SEED_OWNER_EMAIL=you@example.com \
 *     SEED_OWNER_PASSWORD_HASH='$2a$12$…' \
 *     npm run db:seed:owner
 *
 * The full seed is the wrong tool on a database with content in it: it
 * replaces the catalogue, the journal and the pages from `seed-data/*.json`,
 * so running it after restoring a dump would overwrite the dump. This is the
 * part of it that a restored install still needs — see `applyOwner`.
 *
 * `--conditions=react-server` for the same reason as `seed.ts`: the password
 * hashing lives in the application, behind `server-only`.
 */

import 'dotenv/config';

import { db } from '@/lib/db';

import { applyOwner, seedRoles } from './seed/users';

async function main() {
  const roleIds = await seedRoles();
  await applyOwner(roleIds);
}

main()
  .catch((error) => {
    console.error('\nThe owner was not set:\n', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
