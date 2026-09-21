import { CompanyForm, type CompanyFormValue } from '@/components/settings/company-form';
import { PageHeader } from '@/components/shared/page-header';
import { requirePermission } from '@/lib/auth/session';
import { companyForm } from '@/server/services/company';

export const metadata = { title: 'Company' };
export const dynamic = 'force-dynamic';

export default async function CompanyPage() {
  await requirePermission('settings.read');
  const company = await companyForm();

  if (!company) {
    return (
      <>
        <PageHeader title="Company" />
        <p className="text-sm text-muted-foreground">
          There is no company record yet. Run{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:seed</code> in
          apps/admin.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Company"
        description="The name, the address, the telephone number and the social accounts — once, for the whole site. The footer, the contact page, the enquiry emails and the structured data all read from here."
      />
      <CompanyForm initial={company as CompanyFormValue} />
    </>
  );
}
