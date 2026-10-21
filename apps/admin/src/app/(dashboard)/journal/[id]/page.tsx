import { notFound } from 'next/navigation';

import { ContentPreview } from '@/components/content/content-preview';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { siteUrl } from '@/server/services/content-editor';
import { postPreviewData } from '@/server/services/post-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id }, select: { title: true } });
  return { title: post?.title ?? 'Entry' };
}

export default async function PostPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('journal.read');
  const { id } = await params;
  const [data, url, canEdit] = await Promise.all([
    postPreviewData(id),
    siteUrl(),
    hasPermission('journal.write'),
  ]);
  if (!data) notFound();
  return <ContentPreview data={data} siteUrl={url} canEdit={canEdit} />;
}
