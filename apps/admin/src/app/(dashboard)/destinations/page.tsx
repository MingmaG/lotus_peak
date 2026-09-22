import { DestinationsScreen } from '@/components/content/destinations-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Destinations' };
export const dynamic = 'force-dynamic';

export default async function DestinationsPage() {
  await requirePermission('destinations.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('destinations.write'),
    hasPermission('destinations.delete'),
  ]);

  return <DestinationsScreen canWrite={canWrite} canDelete={canDelete} />;
}
