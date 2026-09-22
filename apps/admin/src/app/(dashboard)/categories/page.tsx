import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  await requirePermission('categories.read');

  return (
    <NotBuiltYet
      title="Categories"
      description="A second way of grouping journeys, beside their type."
      willHold={[
        "A name, a description and a photograph",
        "Which journeys are in it",
        "Its own page on the website"
]}
      needs="A Category table. The four journey types cover what the office sells today."
    />
  );
}
