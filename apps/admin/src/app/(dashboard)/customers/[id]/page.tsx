import { notFound } from 'next/navigation';

import { CustomerDetail, type CustomerDetailData } from '@/components/crm/customer-detail';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Customer' };
export const dynamic = 'force-dynamic';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission('customers.read');
  const { id } = await params;

  /**
   * The bookings are only loaded for somebody who may read them.
   *
   * `customers.read` and `bookings.read` are separate permissions and a role
   * can hold the first without the second. Hiding the panel in the component
   * would still have sent the money and the references down the wire, and a
   * hidden section is not a closed door.
   */
  const canSeeBookings = can(user.permissions, 'bookings.read');

  const customer = await db.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      enquiries: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          reference: true,
          status: true,
          createdAt: true,
          trip: { select: { title: true } },
        },
      },
      bookings: canSeeBookings
        ? {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              reference: true,
              status: true,
              kind: true,
              startDate: true,
              currency: true,
              totalCents: true,
              netPaidCents: true,
              refundedCents: true,
              trip: { select: { title: true } },
            },
          }
        : false,
      noteRows: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!customer) notFound();

  /* Dates cross to the client as ISO strings; `Date` objects do not survive
     the boundary in a way `formatDate` can read back. `bookings` is absent
     rather than empty when the permission is missing, so it is defaulted here
     instead of the component having to accept both shapes. */
  const serialised = JSON.parse(JSON.stringify(customer)) as CustomerDetailData;

  return (
    <CustomerDetail
      customer={{ ...serialised, bookings: serialised.bookings ?? [] }}
      canWrite={can(user.permissions, 'customers.write')}
      canDelete={can(user.permissions, 'customers.delete')}
      canSeeBookings={canSeeBookings}
    />
  );
}
