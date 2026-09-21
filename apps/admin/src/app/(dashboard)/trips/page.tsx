import { Plus } from 'lucide-react';
import Link from 'next/link';

import { TripsTable } from '@/components/treks/trips-table';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Journeys' };

export default async function TripsPage() {
  await requirePermission('trips.read');
  const canWrite = await hasPermission('trips.write');

  return (
    <>
      <PageHeader
        title="Journeys"
        description="The journeys the site sells. Each one carries its own itinerary, prices, photographs and questions."
        actions={
          canWrite && (
            <Button asChild>
              <Link href="/trips/new">
                <Plus className="mr-1.5 size-4" />
                New journey
              </Link>
            </Button>
          )
        }
      />
      <TripsTable canWrite={canWrite} />
    </>
  );
}
