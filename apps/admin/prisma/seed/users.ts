import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { SYSTEM_ROLES } from '@/lib/auth/permissions';

/**
 * The roles, and the one login a fresh install needs.
 *
 * `upsert` on the slug rather than `create`, so re-running the seed against an
 * install that already has content in it updates instead of failing — which is
 * what makes `npm run db:seed` safe to run twice.
 *
 * What it does *not* do is write the permissions back over a role that already
 * exists. These four are a starting point the office edits from the Roles
 * screen, and a seed that reset them would quietly undo that work on the next
 * deploy that ran it — the same helpfulness that stops this file resetting the
 * owner's password. The owner is the exception: `*` is what the last-owner
 * guard assumes, so that one is held to it.
 */
export async function seedRoles(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const role of SYSTEM_ROLES) {
    const row = await db.role.upsert({
      where: { slug: role.slug },
      create: {
        name: role.name,
        slug: role.slug,
        description: role.description,
        permissions: role.permissions,
        isSystem: true,
      },
      update: {
        isSystem: true,
        ...(role.slug === 'owner' ? { permissions: role.permissions } : {}),
      },
    });
    ids.set(role.slug, row.id);
  }

  return ids;
}

/**
 * The account a development seed creates, and the one a restored development
 * dump arrives with. `applyOwner` takes it over rather than adding a second
 * owner beside it, because its password is the default printed in README.md.
 */
const PLACEHOLDER_EMAIL = 'owner@lotuspeak.local';
const DEFAULT_PASSWORD = 'Owner@12345';

/**
 * A bcrypt hash as `bcryptjs` writes it. Checked here because a hash that has
 * lost a character — or had `$12$…` eaten by a shell's variable expansion —
 * is stored without complaint and then matches no password, ever.
 */
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

interface OwnerCredentials {
  email: string;
  name: string | undefined;
  passwordHash: string;
  /** Only when it came from the defaults, so it can be printed once. */
  printablePassword: string | undefined;
}

/**
 * `SEED_OWNER_PASSWORD_HASH` wins over `SEED_OWNER_PASSWORD`, so a password
 * can be hashed on one machine and the plain text never reach the server.
 */
async function ownerCredentials(): Promise<OwnerCredentials> {
  const email = (process.env.SEED_OWNER_EMAIL?.trim() || PLACEHOLDER_EMAIL).toLowerCase();
  const name = process.env.SEED_OWNER_NAME?.trim() || undefined;
  const hash = process.env.SEED_OWNER_PASSWORD_HASH?.trim();
  const password = process.env.SEED_OWNER_PASSWORD?.trim();

  if (hash) {
    if (!BCRYPT_HASH.test(hash)) {
      throw new Error(
        'SEED_OWNER_PASSWORD_HASH is not a bcrypt hash ($2a$12$ followed by 53 characters). ' +
          'Quote it in single quotes so the shell leaves the $ signs alone.',
      );
    }
    return { email, name, passwordHash: hash, printablePassword: undefined };
  }

  return {
    email,
    name,
    passwordHash: await hashPassword(password || DEFAULT_PASSWORD),
    printablePassword: password ? undefined : DEFAULT_PASSWORD,
  };
}

/**
 * The owner account, as part of the full seed.
 *
 * Created **only when there is no user at all**. A seed that reset the owner's
 * password every time it ran would mean a re-seed after adding a field quietly
 * restores a published, known password on a live install — which is the kind
 * of helpfulness that ends up in an incident report. Setting the owner on a
 * database that already has users is `applyOwner`, run on purpose.
 */
export async function seedOwner(roleIds: Map<string, string>): Promise<void> {
  const existing = await db.user.count();
  if (existing > 0) {
    console.log('  users        already present, left alone (npm run db:seed:owner sets the owner)');
    return;
  }

  const roleId = roleIds.get('owner');
  if (!roleId) throw new Error('The owner role was not seeded.');

  const owner = await ownerCredentials();

  await db.user.create({
    data: {
      email: owner.email,
      name: owner.name ?? 'Lotus Peak',
      jobTitle: 'Owner',
      passwordHash: owner.passwordHash,
      roleId,
      isActive: true,
    },
  });

  console.log('  users        1 owner created');
  printSignIn(owner);
}

/**
 * The owner account, on a database that may already have one — a restored
 * dump, most often. `npm run db:seed:owner`.
 *
 * Which row it writes to, in order:
 *
 *   1. the user with `SEED_OWNER_EMAIL`, deleted or not — re-running it is how
 *      a forgotten password is reset from the server;
 *   2. the placeholder owner a development dump carries, renamed — so the
 *      photographs and journal entries it is recorded against stay attributed
 *      to the owner, and its published password stops working;
 *   3. a new owner.
 *
 * Unlike the full seed it refuses to run on the defaults: on a live install
 * that would be writing the password from README.md onto the owner.
 */
export async function applyOwner(roleIds: Map<string, string>): Promise<void> {
  const roleId = roleIds.get('owner');
  if (!roleId) throw new Error('The owner role was not seeded.');

  if (!process.env.SEED_OWNER_EMAIL?.trim()) {
    throw new Error('Set SEED_OWNER_EMAIL — the owner this sets is named, not defaulted.');
  }
  if (!process.env.SEED_OWNER_PASSWORD_HASH?.trim() && !process.env.SEED_OWNER_PASSWORD?.trim()) {
    throw new Error(
      'Set SEED_OWNER_PASSWORD_HASH (or SEED_OWNER_PASSWORD). ' +
        `The default, ${DEFAULT_PASSWORD}, is in the repository.`,
    );
  }

  const owner = await ownerCredentials();

  const target =
    (await db.user.findUnique({ where: { email: owner.email } })) ??
    (await db.user.findUnique({ where: { email: PLACEHOLDER_EMAIL } }));

  if (!target) {
    await db.user.create({
      data: {
        email: owner.email,
        name: owner.name ?? 'Lotus Peak',
        jobTitle: 'Owner',
        passwordHash: owner.passwordHash,
        roleId,
        isActive: true,
      },
    });
    console.log(`  owner        ${owner.email} created`);
    return;
  }

  /* Sessions are revoked, not deleted (CLAUDE.md §4). A new password has to
     sign out whoever was holding the old one — on a restored dump, that is
     every browser the dump's owner was signed in from. */
  await db.$transaction([
    db.user.update({
      where: { id: target.id },
      data: {
        email: owner.email,
        ...(owner.name ? { name: owner.name } : {}),
        passwordHash: owner.passwordHash,
        roleId,
        isActive: true,
        failedLogins: 0,
        lockedUntil: null,
        deletedAt: null,
      },
    }),
    db.session.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.passwordResetToken.deleteMany({ where: { userId: target.id } }),
  ]);

  console.log(
    target.email === owner.email
      ? `  owner        ${owner.email} updated, signed out everywhere`
      : `  owner        ${target.email} → ${owner.email}, signed out everywhere`,
  );
}

/** The credentials are printed once, here, and not written anywhere. */
function printSignIn(owner: OwnerCredentials): void {
  console.log('');
  console.log(`    Sign in at http://localhost:6011`);
  console.log(`      ${owner.email}`);
  if (owner.printablePassword) {
    console.log(`      ${owner.printablePassword}`);
    console.log('');
    console.log('    Change that password before this install is reachable from anywhere.');
  }
  console.log('');
}
