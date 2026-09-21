import { UsersScreen } from '@/components/admin/users-screen';
import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await requirePermission('users.read');

  return (
    <>
      <PageHeader
        title="Users"
        description="Who may sign in, and what they may do. Content and personal data are different jobs — the Editor role cannot open an enquiry, and Reservations cannot publish a page."
      />
      <UsersScreen currentUserId={user.id} />
    </>
  );
}
