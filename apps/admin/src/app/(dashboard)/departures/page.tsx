import { DeparturesScreen } from '@/components/crm/departures-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Departures' };
export const dynamic = 'force-dynamic';

export default async function DeparturesPage() {
  await requirePermission('departures.read');
  const canWrite = await hasPermission('departures.write');

  return (
    <>
      <PageHeader
        title="Departures"
        description="Dated departures with prices and places. A journey with none published shows no dates, which is how the site read before this screen existed."
      />
      <DeparturesScreen canWrite={canWrite} />
    </>
  );
}
