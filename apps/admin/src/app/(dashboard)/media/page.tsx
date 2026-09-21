import { MediaLibrary } from '@/components/media/media-library';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Media library' };
export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  await requirePermission('media.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('media.write'),
    hasPermission('media.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Media library"
        description="Every photograph on the site. Each one carries a description, a caption and the point a crop holds — replacing the file behind one updates every page that uses it."
      />
      <MediaLibrary canWrite={canWrite} canDelete={canDelete} />
    </>
  );
}
