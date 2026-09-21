import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Documents' };
export const dynamic = 'force-dynamic';

export default async function CompanyDocumentsPage() {
  await requirePermission('documents.read');

  return (
    <NotBuiltYet
      title="Documents"
      description="The licences and certificates the company is asked for."
      willHold={[
        "The tourism licence, insurance, and the association memberships",
        "When each expires, and a reminder before it does",
        "Which are shown on the website and which are for the file"
]}
      needs="A Document table, and the media library to hold the files."
    />
  );
}
