import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Reviews' };
export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  await requirePermission('reviews.read');

  return (
    <NotBuiltYet
      title="Reviews"
      description="What travellers have said elsewhere, gathered in one place."
      willHold={[
        "Reviews pulled from Google, TripAdvisor and the rest",
        "Which are approved to appear on the website",
        "Which journey each one is about"
]}
      needs="A Review table and a source to read from. Note that this is not Reflections — those are the quotes the design shows, written by the office from what people sent them, and they stay where they are."
    />
  );
}
