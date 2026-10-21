import { notFound } from 'next/navigation';

import { ContentPreview } from '@/components/content/content-preview';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { siteUrl } from '@/server/services/content-editor';
import { destinationPreviewData } from '@/server/services/destination-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.destination.findUnique({ where: { id }, select: { name: true } });
  return { title: row?.name ?? 'Where we go' };
}

/** A valley or a place, as its page — not its form. Edit is one button away. */
export default async function DestinationPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('destinations.read');
  const { id } = await params;
  const [data, url, canEdit] = await Promise.all([
    destinationPreviewData(id),
    siteUrl(),
    hasPermission('destinations.write'),
  ]);
  if (!data) notFound();
  return <ContentPreview data={data} siteUrl={url} canEdit={canEdit} />;
}
