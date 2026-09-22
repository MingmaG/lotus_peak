import { PaymentsScreen } from '@/components/bookings/payments-screen';
import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const user = await requirePermission('payments.read');

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every transaction against every booking. Money is recorded on the booking it belongs to, so this screen reads rather than takes."
      />
      <PaymentsScreen canWrite={can(user.permissions, 'payments.write')} />
    </>
  );
}
