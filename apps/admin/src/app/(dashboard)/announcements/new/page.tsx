import { AnnouncementsScreen } from '@/components/notices/announcements-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'New · Announcements' };
export const dynamic = 'force-dynamic';

export default async function NewAnnouncementsPage() {
  await requirePermission('banners.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('banners.write'),
    hasPermission('banners.delete'),
  ]);

  return <AnnouncementsScreen canWrite={canWrite} canDelete={canDelete} editId={null} />;
}
