import 'server-only';

import {
  renderEnquiryEmail,
  type EmailEnquiry,
  type EmailIdentity,
  type EmailTemplate,
} from '@lotuspeak/email';
import type { EmailKind } from '@prisma/client';

import { db } from '@/lib/db';
import { env, mailConfigured } from '@/lib/env';

/**
 * Turning an enquiry into two messages.
 *
 * One to the traveller, saying somebody has it; one to the office, saying who
 * wrote and what about. Both are built from editable templates — the words are
 * the office's, not the developer's — and both are recorded in
 * `email_messages` whether or not they are actually sent.
 *
 * ## Recording is not optional; sending is
 *
 * With no `RESEND_API_KEY` the message is rendered, stored with status
 * `QUEUED` and logged. That is the correct development default: a seeded
 * database full of test addresses must not be able to email anybody, and an
 * adapter that threw when unconfigured would make every seeded enquiry a
 * failure. It is also what makes the Email screen useful on day one — the
 * office can read exactly what *would* go out before a key is ever set.
 */

export async function deliverEnquiry(enquiryId: string): Promise<void> {
  const enquiry = await db.enquiry.findUnique({
    where: { id: enquiryId },
    include: { trip: { select: { title: true } } },
  });
  if (!enquiry) return;

  const [company, address, contacts, settings] = await Promise.all([
    db.companyProfile.findFirst({ where: { isSingleton: true } }),
    db.address.findFirst({ where: { isPrimary: true } }),
    db.contactChannel.findMany({ where: { isPublic: true }, orderBy: { sortOrder: 'asc' } }),
    db.setting.findMany({ where: { group: 'enquiries' } }),
  ]);
  if (!company) return;

  const on = (key: string): boolean => {
    const value = settings.find((row) => row.key === key)?.value;
    return value !== false;
  };

  const identity: EmailIdentity = {
    name: company.name,
    email: contacts.find((c) => c.kind === 'EMAIL')?.value ?? env.mail.replyTo,
    phone: contacts.find((c) => c.kind === 'PHONE' || c.kind === 'MOBILE')?.display ?? '',
    siteUrl: company.siteUrl.replace(/\/$/, ''),
    addressLine: [address?.line1, address?.locality, address?.country]
      .filter(Boolean)
      .join(', '),
    logoUrl: '',
  };

  const payload: EmailEnquiry = {
    reference: enquiry.reference,
    name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone ?? undefined,
    country: enquiry.country ?? undefined,
    tripTitle: enquiry.trip?.title ?? undefined,
    preferredDates: enquiry.preferredDates ?? undefined,
    travellers: enquiry.travellers ?? undefined,
    message: enquiry.message ?? undefined,
    restDays: enquiry.restDays,
    source: enquiry.source.toLowerCase().replace(/_/g, ' '),
    origin: {
      pagePath: enquiry.pagePath ?? undefined,
      utmSource: enquiry.utmSource ?? undefined,
      utmMedium: enquiry.utmMedium ?? undefined,
      utmCampaign: enquiry.utmCampaign ?? undefined,
    },
  };

  if (on('acknowledgeTraveller')) {
    await send({
      kind: 'ENQUIRY_ACKNOWLEDGEMENT',
      to: [{ email: enquiry.email, name: enquiry.name }],
      identity,
      payload,
      audience: 'traveller',
      replyPromise: company.replyPromise,
      enquiryId: enquiry.id,
    });
  }

  if (on('notifyOffice')) {
    await send({
      kind: 'ENQUIRY_NOTIFICATION',
      to: env.mail.officeTo.map((email) => ({ email, name: null })),
      identity,
      payload,
      audience: 'office',
      replyPromise: company.replyPromise,
      enquiryId: enquiry.id,
    });
  }
}

interface SendArgs {
  kind: EmailKind;
  to: { email: string; name: string | null }[];
  identity: EmailIdentity;
  payload: EmailEnquiry;
  audience: 'traveller' | 'office';
  replyPromise: string;
  enquiryId: string;
}

async function send(args: SendArgs): Promise<void> {
  const row = await db.emailTemplate.findUnique({ where: { kind: args.kind } });
  if (!row || !row.isActive) return;

  const template: EmailTemplate = {
    kind: row.kind,
    name: row.name,
    isActive: row.isActive,
    subject: row.subject,
    preheader: row.preheader,
    eyebrow: row.eyebrow,
    heading: row.heading,
    intro: row.intro,
    closing: row.closing,
    summaryLabel: row.summaryLabel,
    notesLabel: row.notesLabel,
    buttonLabel: row.buttonLabel,
    buttonUrl: row.buttonUrl,
    signOff: row.signOff,
    footNote: row.footNote,
  };

  const rendered = renderEnquiryEmail({
    template,
    identity: args.identity,
    enquiry: args.payload,
    audience: args.audience,
    replyPromise: args.replyPromise,
  });

  for (const recipient of args.to) {
    /**
     * Stored before it is sent, and stored verbatim.
     *
     * A template edited next week must not change the record of what somebody
     * received — which is why `html` and `text` are columns rather than a
     * template id plus the inputs.
     */
    const message = await db.emailMessage.create({
      data: {
        kind: args.kind,
        templateId: row.id,
        toEmail: recipient.email,
        toName: recipient.name,
        fromEmail: env.mail.from,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        enquiryId: args.enquiryId,
        status: 'QUEUED',
      },
    });

    if (!mailConfigured()) {
      console.info(
        `[mail] not sent (RESEND_API_KEY is unset): "${rendered.subject}" → ${recipient.email}`,
      );
      continue;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.mail.resendApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: env.mail.from,
          to: [recipient.email],
          reply_to: env.mail.replyTo,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        await db.emailMessage.update({
          where: { id: message.id },
          data: { status: 'FAILED', error: detail.slice(0, 1_000) },
        });
        continue;
      }

      const body = (await response.json()) as { id?: string };
      await db.emailMessage.update({
        where: { id: message.id },
        data: { status: 'SENT', sentAt: new Date(), providerId: body.id ?? null },
      });
    } catch (error) {
      await db.emailMessage.update({
        where: { id: message.id },
        data: { status: 'FAILED', error: (error as Error).message.slice(0, 1_000) },
      });
    }
  }
}
