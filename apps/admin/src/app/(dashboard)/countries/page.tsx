import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Countries' };
export const dynamic = 'force-dynamic';

export default async function CountriesPage() {
  await requirePermission('countries.read');

  return (
    <NotBuiltYet
      title="Countries"
      description="Where a journey goes, above the level of a valley."
      willHold={[
        "Bhutan, and the neighbours a journey sometimes crosses into",
        "The entry rules that differ by passport",
        "Which journeys visit each"
]}
      needs="A Country table. Every journey is in Bhutan today, which is why this has not been needed."
    />
  );
}
