import Link from 'next/link';

import { EmailsScreen } from '@/components/crm/emails-screen';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { requirePermission } from '@/lib/auth/session';
import { mailConfigured } from '@/lib/env';

export const metadata = { title: 'Email' };
export const dynamic = 'force-dynamic';

export default async function EmailsPage() {
  await requirePermission('emails.read');

  return (
    <>
      <PageHeader
        title="Email"
        description="Every message this site has produced, stored exactly as it went out — a template edited later does not change the record of what somebody received."
        actions={
          <Button variant="outline" asChild>
            <Link href="/emails/templates">Edit the wording</Link>
          </Button>
        }
      />
      <EmailsScreen mailConfigured={mailConfigured()} />
    </>
  );
}
