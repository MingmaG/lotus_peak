import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Forms' };
export const dynamic = 'force-dynamic';

export default async function FormsPage() {
  await requirePermission('forms.read');

  return (
    <NotBuiltYet
      title="Forms"
      description="Everything sent from the website that is not an enquiry."
      willHold={[
        "The traveller information form, filled in after booking",
        "Dietary and medical notes, which need to be handled carefully",
        "Whatever forms the office adds later"
]}
      needs="A FormSubmission table. The enquiry form has its own screen already and stays there."
    />
  );
}
