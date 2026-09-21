import { SeasonsScreen } from '@/components/content/seasons-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Seasons' };
export const dynamic = 'force-dynamic';

export default async function SeasonsPage() {
  await requirePermission('seasons.read');
  const canWrite = await hasPermission('seasons.write');

  return (
    <>
      <PageHeader
        title="Seasons"
        description="The four panels on the home page. There are four, and there is no way to add a fifth."
      />
      <SeasonsScreen canWrite={canWrite} />
    </>
  );
}
