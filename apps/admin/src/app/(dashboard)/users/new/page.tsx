import { UserEditor } from '@/components/admin/user-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'New · Accounts' };
export const dynamic = 'force-dynamic';

export default async function NewUserPage() {
  const user = await requirePermission('users.write');

  const roles = await db.role.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, description: true },
  });

  return (
    <UserEditor
      initial={{
        id: null,
        name: '',
        email: '',
        jobTitle: '',
        /* Editor is the least a new colleague is usually given, so it is the
           one the field starts on rather than whatever sorts first. */
        roleId: roles.find((role) => role.slug === 'editor')?.id ?? roles[0]?.id ?? '',
        isActive: true,
      }}
      roles={roles}
      currentUserId={user.id}
      canWrite={can(user.permissions, 'users.write')}
    />
  );
}
