import { notFound } from 'next/navigation';

import { ContentPreview } from '@/components/content/content-preview';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { siteUrl } from '@/server/services/content-editor';
import { culturePreviewData } from '@/server/services/culture-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.cultureArticle.findUnique({ where: { id }, select: { title: true } });
  return { title: row?.title ?? 'Culture' };
}

export default async function CulturePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('culture.read');
  const { id } = await params;
  const [data, url, canEdit] = await Promise.all([
    culturePreviewData(id),
    siteUrl(),
    hasPermission('culture.write'),
  ]);
  if (!data) notFound();
  return <ContentPreview data={data} siteUrl={url} canEdit={canEdit} />;
}
