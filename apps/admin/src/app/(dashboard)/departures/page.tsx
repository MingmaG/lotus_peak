import { DeparturesScreen } from '@/components/crm/departures-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Departures' };
export const dynamic = 'force-dynamic';

export default async function DeparturesPage() {
  await requirePermission('departures.read');
  const [canWrite, trips] = await Promise.all([
    hasPermission('departures.write'),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Departures"
        description="Dated departures with prices and places. A journey with none published shows no dates, which is how the site read before this screen existed."
      />
      <DeparturesScreen trips={trips} canWrite={canWrite} />
    </>
  );
}
