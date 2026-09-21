import { RedirectsScreen } from '@/components/seo/redirects-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Redirects' };
export const dynamic = 'force-dynamic';

export default async function RedirectsPage() {
  await requirePermission('seo.read');
  const canWrite = await hasPermission('seo.write');

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Where old addresses go. One is written for you whenever a page is renamed — and beside them, the addresses people are actually asking for and not finding."
      />
      <RedirectsScreen canWrite={canWrite} />
    </>
  );
}
