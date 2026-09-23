import { DestinationsList } from '@/components/content/destinations-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Where we go' };
export const dynamic = 'force-dynamic';

export default async function DestinationsPage() {
  await requirePermission('destinations.read');
  return <DestinationsList canWrite={await hasPermission('destinations.write')} />;
}
