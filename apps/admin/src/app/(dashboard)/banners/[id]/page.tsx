import { BannersScreen } from '@/components/notices/banners-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Banners' };
export const dynamic = 'force-dynamic';

export default async function EditBannersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission('banners.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('banners.write'),
    hasPermission('banners.delete'),
  ]);

  return <BannersScreen canWrite={canWrite} canDelete={canDelete} editId={id} />;
}
