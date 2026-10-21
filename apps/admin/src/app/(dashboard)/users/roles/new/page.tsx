import { RoleEditor } from '@/components/admin/role-editor';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'New · Roles' };
export const dynamic = 'force-dynamic';

export default async function NewRolePage() {
  await requirePermission('roles.write');

  return (
    <RoleEditor
      initial={{ id: null, name: '', description: '', permissions: ['dashboard.read'] }}
      canManage
      canDelete={false}
    />
  );
}
