import 'server-only';

import type { ApiEmailTemplate, ApiEnquiryMail } from '@lotuspeak/api-contracts';

import { db } from '@/lib/db';

/**
 * What the website needs in order to write an enquiry's two messages itself.
 *
 * This file used to send them. It publishes them instead, and the difference
 * is the point of the change: the words, the sender's identity and the two
 * switches go out over the public API like every other piece of content, the
 * website caches them for the hour, and it can therefore still write and send
 * both messages when this panel is not answering at all.
 *
 * ## Why the copy travels rather than being read from a file
 *
 * "Thank you for writing to us" is the office's sentence, edited on the Email
 * wording screen, and a website that fell back to a constant would go on
 * sending last year's wording with nothing to say it had. The last published
 * copy is the right answer to an unreachable panel; a developer's copy is not.
 *
 * ## Inactive templates are left out, not sent as inactive
 *
 * The switch means "do not send this", and the safest way to honour it from a
 * cached payload is for the message to be absent from the payload entirely —
 * a flag would need the website to check it, and the failure mode of a missed
 * check is the message the office switched off.
 */

/** The two an enquiry produces. Nothing else is rendered by the website. */
const ENQUIRY_KINDS = ['ENQUIRY_ACKNOWLEDGEMENT', 'ENQUIRY_NOTIFICATION'] as const;

export async function getEnquiryMail(): Promise<ApiEnquiryMail> {
  const [company, address, contacts, settings, templates] = await Promise.all([
    db.companyProfile.findFirst({ where: { isSingleton: true } }),
    db.address.findFirst({ where: { isPrimary: true } }),
    db.contactChannel.findMany({ where: { isPublic: true }, orderBy: { sortOrder: 'asc' } }),
    db.setting.findMany({ where: { group: 'enquiries' } }),
    db.emailTemplate.findMany({ where: { kind: { in: [...ENQUIRY_KINDS] }, isActive: true } }),
  ]);

  if (!company) {
    /* The same hard failure `getSite` makes, for the same reason: a fabricated
       company would sign somebody else's name at the foot of an email. */
    throw new Error(
      'There is no company profile. Run `npm run db:seed` in apps/admin, or fill in Settings → Company.',
    );
  }

  /** An enquiries setting is on unless the office turned it off. */
  const on = (key: string): boolean =>
    settings.find((row) => row.key === key)?.value !== false;

  return {
    identity: {
      name: company.name,
      /* The address the office actually reads, which is the one on the company
         record — not the From address, which may be a no-reply sender the
         provider verified. */
      email: contacts.find((c) => c.kind === 'EMAIL')?.value ?? '',
      phone: contacts.find((c) => c.kind === 'PHONE' || c.kind === 'MOBILE')?.display ?? '',
      siteUrl: company.siteUrl.replace(/\/$/, ''),
      addressLine: [address?.line1, address?.locality, address?.country]
        .filter(Boolean)
        .join(', '),
      logoUrl: '',
    },
    replyPromise: company.replyPromise,
    notifyOffice: on('notifyOffice'),
    acknowledgeTraveller: on('acknowledgeTraveller'),
    templates: templates.map(
      (row): ApiEmailTemplate => ({
        id: row.id,
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
      }),
    ),
  };
}
