import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Comments' };
export const dynamic = 'force-dynamic';

export default async function CommentsPage() {
  await requirePermission('comments.read');

  return (
    <NotBuiltYet
      title="Comments"
      description="Replies to journal entries, waiting to be read."
      willHold={[
        "What was written, on which entry, by whom",
        "Approve, reply or mark as spam",
        "A spam filter, because an open comment form attracts one"
]}
      needs="A Comment table and a form on the journal entry page. The site has neither yet, and an unmoderated comment form is a decision rather than a feature."
    />
  );
}
