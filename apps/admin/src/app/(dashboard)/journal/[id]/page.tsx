import { notFound } from 'next/navigation';

import { PostEditor } from '@/components/content/post-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { postFormData } from '@/server/services/post-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id }, select: { title: true } });
  return { title: post?.title ?? 'Entry' };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('journal.read');
  const { id } = await params;

  const [post, authors, trips, company] = await Promise.all([
    postFormData(id),
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

  if (!post) notFound();

  return (
    <PostEditor
      initial={post}
      authors={authors}
      trips={trips}
      siteUrl={company?.siteUrl ?? 'https://lotuspeak.org'}
      canPublish={can(user.permissions, 'journal.publish')}
    />
  );
}
