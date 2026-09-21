import { CultureScreen } from '@/components/content/culture-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Culture' };
export const dynamic = 'force-dynamic';

export default async function CulturePage() {
  await requirePermission('culture.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('culture.write'),
    hasPermission('culture.delete'),
  ]);

  return (
    <>
      <PageHeader
        title="Culture & traditions"
        description="Short pieces explaining what a traveller is about to see — tshechu, dzongs, textiles, the thirteen arts."
      />
      <CultureScreen canWrite={canWrite} canDelete={canDelete} />
    </>
  );
}
