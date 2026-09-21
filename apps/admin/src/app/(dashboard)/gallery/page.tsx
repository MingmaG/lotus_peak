import { GalleryScreen } from '@/components/content/gallery-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Gallery' };
export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  await requirePermission('gallery.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('gallery.write'),
    hasPermission('gallery.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Gallery"
        description="Photographs of Bhutan, in the order the masonry lays them out. Mixed shapes are what stop it reading as a grid."
      />
      <GalleryScreen canWrite={canWrite} canDelete={canDelete} />
    </>
  );
}
