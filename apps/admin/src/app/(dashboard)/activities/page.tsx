import { ActivitiesScreen } from '@/components/content/activities-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'What you can do' };
export const dynamic = 'force-dynamic';

export default async function ActivitiesPage() {
  await requirePermission('activities.read');
  const [canWrite, canDelete, trips] = await Promise.all([
    hasPermission('activities.write'),
    hasPermission('activities.delete'),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="What you can do"
        description="Three ways of reading the same journeys — the culture, the practice, the walking. Not a separate product: every journey has some of all three."
      />
      <ActivitiesScreen canWrite={canWrite} canDelete={canDelete} trips={trips} />
    </>
  );
}
