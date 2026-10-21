import { notFound } from 'next/navigation';

import { UserEditor } from '@/components/admin/user-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findFirst({
    where: { id, deletedAt: null },
    select: { name: true },
  });
  return { title: user?.name ?? 'Account' };
}

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission('users.read');
  const { id } = await params;

  const [account, roles] = await Promise.all([
    /* Selected field by field: the row also holds the password hash, and a
       Server Component's props are sent to the browser whole. */
    db.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, email: true, jobTitle: true, roleId: true, isActive: true },
    }),
    db.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, description: true },
    }),
  ]);
  if (!account) notFound();

  return (
    <UserEditor
      initial={{ ...account, jobTitle: account.jobTitle ?? '' }}
      roles={roles}
      currentUserId={actor.id}
      canWrite={can(actor.permissions, 'users.write')}
    />
  );
}
