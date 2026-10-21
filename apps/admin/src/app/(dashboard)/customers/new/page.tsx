import { CustomerEditor } from '@/components/crm/customer-form';
import { blankCustomer } from '@/components/crm/customer-record';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'New · Customers' };
export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  await requirePermission('customers.write');
  return <CustomerEditor initial={blankCustomer()} />;
}
