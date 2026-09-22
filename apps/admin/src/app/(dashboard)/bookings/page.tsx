import { Plus } from 'lucide-react';
import Link from 'next/link';

import { BookingsTable } from '@/components/bookings/bookings-table';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Bookings' };
export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  const user = await requirePermission('bookings.read');
  const canWrite = can(user.permissions, 'bookings.write');

  const trips = await db.trip.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true },
  });

  return (
    <>
      <PageHeader
        title="Bookings"
        description="A journey somebody has committed to: who is coming, what it costs, and what they have paid."
        actions={
          canWrite ? (
            <Button asChild size="sm">
              <Link href="/bookings/new">
                <Plus className="mr-1.5 size-3.5" />
                Take a booking
              </Link>
            </Button>
          ) : undefined
        }
      />
      <BookingsTable trips={trips} canWrite={canWrite} />
    </>
  );
}
