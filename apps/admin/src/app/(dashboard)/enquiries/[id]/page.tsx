import { notFound } from 'next/navigation';

import { EnquiryDetail, type EnquiryDetailData } from '@/components/crm/enquiry-detail';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enquiry = await db.enquiry.findUnique({ where: { id }, select: { name: true } });
  return { title: enquiry ? `${enquiry.name} — enquiry` : 'Enquiry' };
}

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('enquiries.read');
  const { id } = await params;

  const [enquiry, users] = await Promise.all([
    db.enquiry.findUnique({
      where: { id },
      include: {
        trip: { select: { id: true, title: true, slug: true } },
        assignee: { select: { id: true, name: true } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            kind: true,
            toEmail: true,
            subject: true,
            status: true,
            sentAt: true,
            error: true,
            createdAt: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!enquiry || enquiry.deletedAt) notFound();

  /**
   * Marked read on open, here rather than in the client.
   *
   * The unread count on the dashboard is the one number that has to be
   * trustworthy, and a count that only falls when somebody presses a button is
   * a count everybody learns to ignore.
   */
  if (enquiry.status === 'NEW') {
    await db.enquiry.update({ where: { id }, data: { status: 'READ' } });
    enquiry.status = 'READ';
  }

  /* Dates cross to the client as ISO strings; `Date` objects do not survive
     the boundary in a way `formatDateTime` can read back. */
  const serialised = JSON.parse(JSON.stringify(enquiry)) as EnquiryDetailData;

  return (
    <EnquiryDetail
      enquiry={serialised}
      users={users}
      canWrite={can(user.permissions, 'enquiries.write')}
      canDelete={can(user.permissions, 'enquiries.delete')}
      canBook={can(user.permissions, 'bookings.write')}
    />
  );
}
