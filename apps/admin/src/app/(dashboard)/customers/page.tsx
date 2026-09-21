import { CustomersScreen } from '@/components/crm/simple-list-screens';
import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  await requirePermission('customers.read');

  return (
    <>
      <PageHeader
        title="Customers"
        description="People the office has decided are one person across several enquiries. That is a judgement rather than something to guess from a matching address, so nothing here is created automatically."
      />
      <CustomersScreen />
    </>
  );
}
