import { ActivityTable } from '@/components/admin/activity-table';
import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Activity' };
export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  await requirePermission('activity.read');

  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every save, publish, delete and sign-in, with who did it and which fields moved. Read-only — an audit log with a delete button is not one."
      />
      <ActivityTable users={users} />
    </>
  );
}
