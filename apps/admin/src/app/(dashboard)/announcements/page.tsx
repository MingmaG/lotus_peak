import { AnnouncementsScreen } from '@/components/notices/announcements-screen';
import { NoticeTabs } from '@/components/notices/schedule';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Announcements' };
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  await requirePermission('banners.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('banners.write'),
    hasPermission('banners.delete'),
  ]);

  return (
    <>
      <NoticeTabs />
      <AnnouncementsScreen canWrite={canWrite} canDelete={canDelete} />
    </>
  );
}
