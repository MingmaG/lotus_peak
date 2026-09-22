import { notFound } from 'next/navigation';

import { DestinationEditor } from '@/components/content/destination-editor';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { siteUrl } from '@/server/services/content-editor';
import { destinationFormData, valleyOptions } from '@/server/services/destination-form';

export const metadata = { title: 'Edit — Where we go' };
export const dynamic = 'force-dynamic';

export default async function EditDestinationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('destinations.write');
  const { id } = await params;
  const [initial, valleys, url, canPublish, canDelete] = await Promise.all([
    destinationFormData(id),
    valleyOptions(id),
    siteUrl(),
    hasPermission('destinations.publish'),
    hasPermission('destinations.delete'),
  ]);
  if (!initial) notFound();
  return (
    <DestinationEditor
      initial={initial}
      valleys={valleys}
      siteUrl={url}
      canPublish={canPublish}
      canDelete={canDelete}
    />
  );
}
