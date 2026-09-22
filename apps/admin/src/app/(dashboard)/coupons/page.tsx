import { CouponsScreen } from '@/components/bookings/coupons-screen';
import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Coupons' };
export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  const user = await requirePermission('coupons.read');

  return (
    <>
      <PageHeader
        title="Coupons"
        description="A code, what it takes off, and who may use it. Applied by the office on a booking — nothing on the website reads these."
      />
      <CouponsScreen canWrite={can(user.permissions, 'coupons.write')} />
    </>
  );
}
