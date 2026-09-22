import { CustomersScreen } from '@/components/crm/simple-list-screens';
import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const user = await requirePermission('customers.read');

  return (
    <>
      <PageHeader
        title="Customers"
        description="Who a booking is invoiced to, and who several enquiries turn out to be one of. Neither is guessed from a matching address — both are somebody's judgement, so nothing here is created automatically."
      />
      <CustomersScreen canWrite={can(user.permissions, 'customers.write')} />
    </>
  );
}
