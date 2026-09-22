import { EmailTemplatesScreen } from '@/components/crm/email-templates-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Email wording' };
export const dynamic = 'force-dynamic';

export default async function EmailTemplatesPage() {
  await requirePermission('emails.read');
  const canWrite = await hasPermission('emails.write');

  return (
    <>
      <PageHeader
        title="Email wording"
        description="What each message says. “Thank you for writing to us” is copy, and copy is yours — every word here can change without a developer."
      />
      <EmailTemplatesScreen canWrite={canWrite} />
    </>
  );
}
