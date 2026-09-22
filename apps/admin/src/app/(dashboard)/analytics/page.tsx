import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  await requirePermission('analytics.read');

  return (
    <NotBuiltYet
      title="Analytics"
      description="What people did on the website, in terms this office cares about."
      willHold={[
        "Which journeys are read, and which are only opened",
        "Where enquiries come from, and which pages they come after",
        "What people search for on the site and do not find"
]}
      needs="An analytics source. The 404 log and the enquiry attribution already collect part of this — see Redirects and Enquiries."
    />
  );
}
