import { DestinationEditor } from '@/components/content/destination-editor';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { siteUrl } from '@/server/services/content-editor';
import { emptyDestinationForm, valleyOptions } from '@/server/services/destination-form';

export const metadata = { title: 'New — Where we go' };
export const dynamic = 'force-dynamic';

/** `?parent=<id>` starts a place inside that valley; without it, a valley. */
export default async function NewDestinationPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  await requirePermission('destinations.write');
  const { parent } = await searchParams;
  const [valleys, url, canPublish] = await Promise.all([
    valleyOptions(),
    siteUrl(),
    hasPermission('destinations.publish'),
  ]);
  const parentId = valleys.some((v) => v.id === parent) ? parent! : null;
  return (
    <DestinationEditor
      initial={emptyDestinationForm(parentId)}
      valleys={valleys}
      siteUrl={url}
      canPublish={canPublish}
      canDelete={false}
    />
  );
}
