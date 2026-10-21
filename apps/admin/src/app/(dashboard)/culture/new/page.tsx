import { CultureEditor } from '@/components/content/culture-editor';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { linkOptions, placeOptions, siteUrl } from '@/server/services/content-editor';
import { emptyCultureForm } from '@/server/services/culture-form';

export const metadata = { title: 'New — Culture' };
export const dynamic = 'force-dynamic';

export default async function NewCulturePage() {
  await requirePermission('culture.write');
  const [options, url, canPublish] = await Promise.all([
    linkOptions(),
    siteUrl(),
    hasPermission('culture.publish'),
  ]);
  return (
    <CultureEditor
      initial={emptyCultureForm()}
      places={placeOptions(options)}
      siteUrl={url}
      canPublish={canPublish}
      canDelete={false}
    />
  );
}
