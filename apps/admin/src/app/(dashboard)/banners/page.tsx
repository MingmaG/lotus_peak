import { BannersScreen } from '@/components/notices/banners-screen';
import { NoticeTabs } from '@/components/notices/schedule';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Banners' };
export const dynamic = 'force-dynamic';

export default async function BannersPage() {
  await requirePermission('banners.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('banners.write'),
    hasPermission('banners.delete'),
  ]);

  return (
    <>
      <NoticeTabs />
      <BannersScreen canWrite={canWrite} canDelete={canDelete} />
    </>
  );
}
