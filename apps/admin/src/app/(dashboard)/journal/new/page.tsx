import { PostEditor } from '@/components/content/post-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { emptyPostForm } from '@/server/services/post-form';

export const metadata = { title: 'New entry' };
export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  const user = await requirePermission('journal.write');

  const [authors, trips, company] = await Promise.all([
    db.user.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
    db.companyProfile.findFirst({ select: { siteUrl: true } }),
  ]);

  return (
    <PostEditor
      initial={emptyPostForm()}
      authors={authors}
      trips={trips}
      siteUrl={company?.siteUrl ?? 'https://lotuspeak.org'}
      canPublish={can(user.permissions, 'journal.publish')}
    />
  );
}
