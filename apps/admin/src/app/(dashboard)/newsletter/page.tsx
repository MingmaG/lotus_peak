import { NewsletterScreen } from '@/components/crm/simple-list-screens';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Newsletter' };
export const dynamic = 'force-dynamic';

export default async function NewsletterPage() {
  await requirePermission('newsletter.read');
  const canWrite = await hasPermission('newsletter.write');

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Who has asked for the letters. Addresses are confirmed by email before they count, so an unconfirmed one is a typo or a bot rather than a subscriber."
      />
      <NewsletterScreen canWrite={canWrite} />
    </>
  );
}
