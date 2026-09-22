import { PeopleScreen } from '@/components/content/people-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'People' };
export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  await requirePermission('people.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('people.write'),
    hasPermission('people.delete'),
  ]);

  return <PeopleScreen canWrite={canWrite} canDelete={canDelete} />;
}
