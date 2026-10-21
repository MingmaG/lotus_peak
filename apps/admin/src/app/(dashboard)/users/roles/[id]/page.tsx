import { notFound } from 'next/navigation';

import { RoleEditor } from '@/components/admin/role-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await db.role.findUnique({ where: { id }, select: { name: true } });
  return { title: role?.name ?? 'Role' };
}

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('roles.read');
  const { id } = await params;

  const role = await db.role.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, description: true, permissions: true, isSystem: true },
  });
  if (!role) notFound();

  /* The owner role is fixed — the API refuses any change to it — so its page
     reads rather than edits, the same as for somebody without roles.write. */
  const canManage = can(user.permissions, 'roles.write') && role.slug !== 'owner';

  return (
    <RoleEditor
      initial={{
        id: role.id,
        name: role.name,
        description: role.description ?? '',
        permissions: role.permissions,
      }}
      canManage={canManage}
      canDelete={canManage && !role.isSystem}
    />
  );
}
