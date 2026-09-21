import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  await requirePermission('payments.read');

  return (
    <NotBuiltYet
      title="Payments"
      description="What has been paid against each booking, and what has not."
      willHold={[
        "Deposits, balances and refunds against a booking",
        "The payment provider’s own reference, for reconciling",
        "What is overdue, which is the only figure anybody opens this screen for"
]}
      needs="A Payment table and a payment provider. Bhutan’s options differ from the usual ones, so the choice is the office’s to make first."
    />
  );
}
