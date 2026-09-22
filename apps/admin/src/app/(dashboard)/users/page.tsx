import { AccountsScreen } from '@/components/admin/accounts-screen';
import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Accounts' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await requirePermission('users.read');

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Who may sign in, and what they may do. A role is a job rather than a rank — content and personal data are different work, so the Editor role cannot open an enquiry and Reservations cannot publish a page. Change what a role means under Roles, or add one of your own."
      />
      <AccountsScreen
        currentUserId={user.id}
        canWriteUsers={can(user.permissions, 'users.write')}
        canSeeRoles={can(user.permissions, 'roles.read')}
        canManageRoles={can(user.permissions, 'roles.write')}
      />
    </>
  );
}
