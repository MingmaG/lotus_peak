import 'server-only';

import {
  renderEnquiryEmail,
  type EmailEnquiry,
  type EmailIdentity,
  type EmailTemplate,
} from '@lotuspeak/email';
import type { EmailKind } from '@prisma/client';

import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendEmail } from '@/server/services/mailer';

/**
 * Turning an enquiry into two messages.
 *
 * One to the traveller, saying somebody has it; one to the office, saying who
 * wrote and what about. Both are built from editable templates — the words are
 * the office's, not the developer's — and both are recorded in
 * `email_messages` whether or not they are actually sent.
 *
 * ## What this file decides, and what it does not
 *
 * It decides who is written to and which words they get. How a message is
 * handed to the provider, recorded, capped and followed to its delivery is
 * `services/mailer`, which knows nothing about enquiries — so a second thing
 * worth emailing (a newsletter confirmation, a password reset) reaches the
 * same log without touching any of this.
 *
 * ## Neither message can fail the enquiry
 *
 * `sendEmail` does not throw for a delivery failure, and the two sends are
 * separate awaits rather than one `Promise.all`. A bounced acknowledgement — a
 * typo'd address, a full mailbox — must not stop the office being told that
 * somebody wrote in.
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

  /* The office first. It is the message that must not be lost — an
     acknowledgement nobody receives is a discourtesy, an enquiry nobody in the
     office ever sees is the business failing at the one thing this site is
     for. Sending it before the traveller's copy means a cap, an outage or a
     crash between the two costs the courtesy rather than the lead. */
  if (on('notifyOffice')) {
    await send({
      kind: 'ENQUIRY_NOTIFICATION',
      to: env.mail.officeTo.map((email) => ({ email, name: null })),
      identity,
      payload,
      audience: 'office',
      replyPromise: company.replyPromise,
      enquiryId: enquiry.id,
      replyTo: enquiry.email,
    });
  }

  if (on('acknowledgeTraveller')) {
    await send({
      kind: 'ENQUIRY_ACKNOWLEDGEMENT',
      to: [{ email: enquiry.email, name: enquiry.name }],
      identity,
      payload,
      audience: 'traveller',
      replyPromise: company.replyPromise,
      enquiryId: enquiry.id,
      /* Replies come back to the address the office actually reads, which is
         the one on the company record — not the From address, which may be a
         no-reply sender the provider verified. */
      replyTo: identity.email || env.mail.replyTo,
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
  /**
   * Where the recipient's "Reply" goes.
   *
   * On the office's copy this is the traveller, and it is the whole mechanism:
   * somebody reads the notification, presses Reply, and the thread continues
   * with the person who wrote in. Without it every reply goes to the company's
   * own address and has to be re-addressed by hand.
   */
  replyTo: string;
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
    await sendEmail({
      kind: args.kind,
      toEmail: recipient.email,
      toName: recipient.name,
      replyTo: args.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateId: row.id,
      enquiryId: args.enquiryId,
    });
  }
}
