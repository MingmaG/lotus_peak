import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { SYSTEM_ROLES } from '@/lib/auth/permissions';

/**
 * The roles, and the one login a fresh install needs.
 *
 * `upsert` on the slug rather than `create`, so re-running the seed after
 * adding a permission to a role updates it instead of failing — which is what
 * makes `npm run db:seed` safe to run against an install that already has
 * content in it.
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
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: true,
      },
    });
    ids.set(role.slug, row.id);
  }

  return ids;
}

/**
 * The owner account.
 *
 * Created **only when there is no user at all**. A seed that reset the owner's
 * password every time it ran would mean a re-seed after adding a field quietly
 * restores a published, known password on a live install — which is the kind
 * of helpfulness that ends up in an incident report.
 *
 * The credentials are printed once, here, and not written anywhere.
 */
export async function seedOwner(roleIds: Map<string, string>): Promise<void> {
  const existing = await db.user.count();
  if (existing > 0) {
    console.log('  users        already present, left alone');
    return;
  }

  const roleId = roleIds.get('owner');
  if (!roleId) throw new Error('The owner role was not seeded.');

  const email = process.env.SEED_OWNER_EMAIL?.trim() || 'owner@lotuspeak.local';
  const password = process.env.SEED_OWNER_PASSWORD?.trim() || 'Owner@12345';

  await db.user.create({
    data: {
      email: email.toLowerCase(),
      name: process.env.SEED_OWNER_NAME?.trim() || 'Lotus Peak',
      jobTitle: 'Owner',
      passwordHash: await hashPassword(password),
      roleId,
      isActive: true,
    },
  });

  console.log('  users        1 owner created');
  console.log('');
  console.log(`    Sign in at http://localhost:6011`);
  console.log(`      ${email}`);
  console.log(`      ${password}`);
  console.log('');
  console.log('    Change that password before this install is reachable from anywhere.');
  console.log('');
}
