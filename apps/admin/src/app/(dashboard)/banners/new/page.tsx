import { BannersScreen } from '@/components/notices/banners-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'New · Banners' };
export const dynamic = 'force-dynamic';

export default async function NewBannersPage() {
  await requirePermission('banners.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('banners.write'),
    hasPermission('banners.delete'),
  ]);

  return <BannersScreen canWrite={canWrite} canDelete={canDelete} editId={null} />;
}
