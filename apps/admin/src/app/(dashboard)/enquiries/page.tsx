import { EnquiriesTable } from '@/components/crm/enquiries-table';
import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Enquiries' };
export const dynamic = 'force-dynamic';

export default async function EnquiriesPage() {
  await requirePermission('enquiries.read');

  const [users, trips] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Everybody who has written in. Opening one marks it read, so the unread count on the dashboard means what it says."
      />
      <EnquiriesTable users={users} trips={trips} />
    </>
  );
}
