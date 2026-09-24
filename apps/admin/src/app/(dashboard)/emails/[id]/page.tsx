import { notFound } from 'next/navigation';

import { EmailDetail, type EmailDetailData } from '@/components/crm/email-detail';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mailWebhookConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const message = await db.emailMessage.findUnique({ where: { id }, select: { subject: true } });
  return { title: message ? `${message.subject} — email` : 'Email' };
}

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('emails.read');
  const { id } = await params;

  const message = await db.emailMessage.findUnique({
    where: { id },
    include: {
      enquiry: { select: { id: true, reference: true, name: true } },
      template: { select: { id: true, name: true } },
      /* Oldest first is the merge order the history wants; a notice that
         arrived late still sorts by when it happened, not when we heard. */
      events: {
        orderBy: { occurredAt: 'asc' },
        select: { id: true, type: true, status: true, occurredAt: true, createdAt: true },
      },
    },
  });

  if (!message) notFound();

  /* Dates cross to the component as ISO strings; `Date` objects do not survive
     the boundary in a way `formatDateTime` can read back. */
  const serialised = JSON.parse(JSON.stringify(message)) as EmailDetailData;

  return <EmailDetail message={serialised} webhookConfigured={mailWebhookConfigured()} />;
}
