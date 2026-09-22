import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Banners' };
export const dynamic = 'force-dynamic';

export default async function BannersPage() {
  await requirePermission('banners.read');

  return (
    <NotBuiltYet
      title="Banners"
      description="The strip above the navigation, when there is something to say."
      willHold={[
        "One line of text, a link, and the dates it runs between",
        "Which pages it appears on",
        "Somewhere to turn it off quickly"
]}
      needs="A Banner table and a slot in the site’s chrome. The design has no banner in it today, so this needs a design decision before it needs a table."
    />
  );
}
