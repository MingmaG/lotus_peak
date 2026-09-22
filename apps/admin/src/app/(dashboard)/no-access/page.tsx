import Link from 'next/link';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NAVIGATION } from '@/config/navigation';
import { db } from '@/lib/db';
import { RESOURCE_META, isPermission, type Resource } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';

export const metadata = { title: 'No access' };
export const dynamic = 'force-dynamic';

/**
 * Where a permission check sends somebody.
 *
 * It says three things, because a locked door that says only "forbidden"
 * sends the person to whoever is nearest rather than to whoever can help:
 * what they were trying to open, what their role is, and the name of somebody
 * who can change it. The alternative — a 500 with a digest — was what this
 * screen replaced.
 */
export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string }>;
}) {
  const user = await requireUser();
  const { need } = await searchParams;

  const permission = need && isPermission(need) ? need : null;
  const screen = permission
    ? NAVIGATION.flatMap((group) => group.items).find((item) => item.permission === permission)
    : undefined;
  const area = permission
    ? RESOURCE_META[permission.split('.')[0] as Resource]?.label
    : undefined;

  /* Who to ask. `*` is the owner; `roles.write` is anybody the owner has
     trusted with the Roles screen. Three names is a person to find, not a
     directory. */
  const canHelp = await db.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: { permissions: { hasSome: ['*', 'roles.write'] } },
    },
    select: { name: true },
    orderBy: { name: 'asc' },
    take: 3,
  });

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <Lock className="mx-auto size-8 text-muted-foreground" />

      <h1 className="mt-4 text-xl font-medium tracking-tight">
        {screen ? `${screen.label} is not yours to open` : 'That screen is not yours to open'}
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        You are signed in as {user.name}, and your role does not include{' '}
        {area ? <strong className="font-medium text-foreground">{area}</strong> : 'this'}
        {permission && <> — the permission is {permission}</>}. Nothing is wrong; this is the
        panel doing what it was set up to do.
      </p>

      {canHelp.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {listNames(canHelp)} can change what your role is allowed to do.
        </p>
      )}

      <div className="mt-6 flex justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to the dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

/** "Pema, Sonam and Karma" — an Oxford-comma-free list, as British usage. */
function listNames(people: { name: string }[]): string {
  const names = people.map((person) => person.name);
  const last = names.pop() ?? '';
  return names.length === 0 ? last : `${names.join(', ')} and ${last}`;
}
