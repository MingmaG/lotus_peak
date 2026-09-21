import { DestinationsScreen } from '@/components/content/destinations-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Destinations' };
export const dynamic = 'force-dynamic';

export default async function DestinationsPage() {
  await requirePermission('destinations.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('destinations.write'),
    hasPermission('destinations.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Where we go"
        description="The valleys the journeys pass through. Drag to reorder — the order here is the order /destinations shows them in."
      />
      <DestinationsScreen canWrite={canWrite} canDelete={canDelete} />
    </>
  );
}
