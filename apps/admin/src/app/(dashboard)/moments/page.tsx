import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Moments' };
export const dynamic = 'force-dynamic';

export default async function MomentsPage() {
  await requirePermission('moments.read');

  return (
    <NotBuiltYet
      title="Moments"
      description="Short films and photographs from journeys as they happen."
      willHold={[
        "A clip or a photograph, a line about it, and where it was taken",
        "Which journey it came from",
        "The order they appear on the website"
]}
      needs="A Moment table. The media library and the video façade already exist, so this is mostly a screen."
    />
  );
}
