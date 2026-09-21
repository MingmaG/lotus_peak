import { DiscoveryScreen } from '@/components/seo/discovery-screen';
import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'AI and discovery' };
export const dynamic = 'force-dynamic';

export default async function DiscoveryPage() {
  await requirePermission('seo.read');
  const company = await db.companyProfile.findFirst({ select: { siteUrl: true } });

  return (
    <>
      <PageHeader
        title="AI and discovery"
        description="What a search engine and a generative engine are given, and the handful of things that quietly stop a page being found."
      />
      <DiscoveryScreen siteUrl={company?.siteUrl ?? 'http://localhost:6010'} />
    </>
  );
}
