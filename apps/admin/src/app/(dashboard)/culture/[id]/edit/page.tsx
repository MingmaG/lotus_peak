import { notFound } from 'next/navigation';

import { CultureEditor } from '@/components/content/culture-editor';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { linkOptions, placeOptions, siteUrl } from '@/server/services/content-editor';
import { cultureFormData } from '@/server/services/culture-form';

export const metadata = { title: 'Edit — Culture' };
export const dynamic = 'force-dynamic';

export default async function EditCulturePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('culture.write');
  const { id } = await params;
  const [initial, options, url, canPublish, canDelete] = await Promise.all([
    cultureFormData(id),
    linkOptions(),
    siteUrl(),
    hasPermission('culture.publish'),
    hasPermission('culture.delete'),
  ]);
  if (!initial) notFound();
  return (
    <CultureEditor
      initial={initial}
      places={placeOptions(options)}
      siteUrl={url}
      canPublish={canPublish}
      canDelete={canDelete}
    />
  );
}
