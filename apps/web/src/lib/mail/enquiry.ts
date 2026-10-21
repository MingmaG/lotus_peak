import 'server-only'

import type { ApiEmailRecord, ApiEnquiryMail } from '@lotuspeak/api-contracts'
import {
  DEFAULT_TEMPLATES,
  renderEnquiryEmail,
  type EmailEnquiry,
  type EmailIdentity,
  type EmailTemplate,
} from '@lotuspeak/email'

import { getContent } from '@/content'
import type { EnquiryReceipt } from '@/content/repository'

import { handOver, mailConfigured, mailSender, type MailSender } from './resend'

/**
 * Turning an enquiry into two messages, and sending them from here.
 *
 * One to the traveller, saying somebody has it; one to the office, saying who
 * wrote and what about. Both are built from the templates the office edits in
 * the panel, which travel to this site like any other content and are cached
 * here for the hour — so the words are the office's, and they are still the
 * office's words on a day the panel cannot be reached.
 *
 * ## The order, and why it is this order
 *
 * The enquiry is written down first, by the panel, and only then is anything
 * sent. That is what keeps the panel's rate limit, its honeypot and its
 * reference number in front of the provider rather than behind it. If the
 * panel could not be reached, the mail goes anyway and carries a notice saying
 * so — an enquiry that exists only as an email is recoverable; one that exists
 * nowhere is not.
 *
 * The office is written to before the traveller, because an unacknowledged
 * traveller is a discourtesy and an unseen enquiry is the business failing at
 * the one thing this site is for. Anything that goes wrong between the two
 * should cost the courtesy, not the lead.
 *
 * ## Nothing in here throws
 *
 * The caller has an enquiry that has already been accepted, and a provider
 * having a bad afternoon must not turn into an error on a form somebody filled
 * in. Failures land in the record — which the panel shows on its Email screen
 * — and in the log.
 */

export interface EnquiryForMail {
  name: string
  email: string
  phone?: string
  country?: string
  tripSlug?: string
  travellers?: string
  preferredDates?: string
  message?: string
  restDays: boolean
  source: string
}

export interface DeliveryOutcome {
  /**
   * True only when the provider accepted the office's copy.
   *
   * It is what lets the route answer honestly when the panel never recorded
   * the enquiry: somebody in the office has it, so "sent" is true.
   */
  officeSent: boolean
}

/** Said to the office, by this code, and not switchable off. See `notice`. */
const NOT_RECORDED =
  'This enquiry is not in the panel — it could not be reached when it arrived. ' +
  'This email is the only copy. Reply to it directly.'

export async function deliverEnquiryMail(args: {
  enquiry: EnquiryForMail
  /** Null when the panel never answered, which changes almost everything. */
  receipt: EnquiryReceipt | null
}): Promise<DeliveryOutcome> {
  const sender = mailSender()
  const configured = mailConfigured(sender)

  if (sender.officeTo.length === 0) {
    console.error('[mail] MAIL_OFFICE_TO is not set, so nobody in the office is written to.')
  }

  const config = await settings(sender)
  const records: ApiEmailRecord[] = []

  /**
   * How many more messages the panel will let us hand over today.
   *
   * No receipt means no allowance to consult, and that is deliberately read as
   * "send": a panel we cannot reach is the one moment the mail is the only
   * thing carrying the enquiry, and a cap is the wrong thing to die on.
   */
  let remaining = args.receipt ? args.receipt.mailRemaining : Number.POSITIVE_INFINITY

  const payload: EmailEnquiry = {
    reference: args.receipt?.reference ?? '',
    name: args.enquiry.name,
    email: args.enquiry.email,
    phone: args.enquiry.phone,
    country: args.enquiry.country,
    tripTitle: await tripTitle(args.enquiry.tripSlug),
    preferredDates: args.enquiry.preferredDates,
    travellers: args.enquiry.travellers,
    message: args.enquiry.message,
    restDays: args.enquiry.restDays,
    source: args.enquiry.source.replace(/-/g, ' '),
    notice: args.receipt ? undefined : NOT_RECORDED,
  }

  const deliver = async (to: string, message: {
    kind: ApiEmailRecord['kind']
    templateId: string | null
    toName: string | null
    replyTo: string
    subject: string
    html: string
    text: string
  }): Promise<boolean> => {
    const base = {
      kind: message.kind,
      templateId: message.templateId,
      toEmail: to,
      toName: message.toName,
      fromEmail: sender.from,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      enquiryId: args.receipt?.id ?? null,
      providerId: null,
      error: null,
      sentAt: null,
      /* Everything but the outcome, which is the next few lines' business. */
    } satisfies Omit<ApiEmailRecord, 'status'>

    if (!configured) {
      console.info(`[mail] not sent (RESEND_API_KEY is unset): "${message.subject}" → ${to}`)
      records.push({ ...base, status: 'QUEUED' })
      return false
    }

    if (remaining <= 0) {
      console.warn(`[mail] not sent (the day's allowance is spent): "${message.subject}" → ${to}`)
      records.push({
        ...base,
        status: 'SKIPPED',
        error: "The day's sending allowance was already spent.",
      })
      return false
    }

    /* Counted on the handover rather than on the answer, so a send that hangs
       still spent what it spent. */
    remaining -= 1

    try {
      const providerId = await handOver(
        { to, replyTo: message.replyTo, subject: message.subject, html: message.html, text: message.text },
        sender,
      )
      records.push({
        ...base,
        status: 'SENT',
        providerId,
        sentAt: new Date().toISOString(),
      })
      return true
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error(`[mail] ${message.kind} to ${to} failed:`, detail)
      records.push({ ...base, status: 'FAILED', error: detail })
      return false
    }
  }

  let officeSent = false

  const notification = config.templates.find((t) => t.kind === 'ENQUIRY_NOTIFICATION')
  if (config.notifyOffice && notification) {
    const rendered = renderEnquiryEmail({
      template: notification,
      identity: config.identity,
      enquiry: payload,
      audience: 'office',
      replyPromise: config.replyPromise,
    })
    for (const address of sender.officeTo) {
      const sent = await deliver(address, {
        kind: 'ENQUIRY_NOTIFICATION',
        /* Empty when the words came from the seeded defaults rather than from
           a row on the panel, and it has to reach the panel as null: the
           column is a foreign key, and '' refers to a template that does not
           exist, which loses the record of the very message this fallback
           exists to send. */
        templateId: notification.id || null,
        toName: null,
        /* The whole mechanism of the office's copy: somebody reads it, presses
           Reply, and the thread continues with the person who wrote in. */
        replyTo: args.enquiry.email,
        ...rendered,
      })
      officeSent = officeSent || sent
    }
  }

  const acknowledgement = config.templates.find((t) => t.kind === 'ENQUIRY_ACKNOWLEDGEMENT')
  if (config.acknowledgeTraveller && acknowledgement) {
    const rendered = renderEnquiryEmail({
      template: acknowledgement,
      identity: config.identity,
      enquiry: payload,
      audience: 'traveller',
      replyPromise: config.replyPromise,
    })
    await deliver(args.enquiry.email, {
      kind: 'ENQUIRY_ACKNOWLEDGEMENT',
      templateId: acknowledgement.id || null,
      toName: args.enquiry.name,
      /* Replies come back to the address the office actually reads, which is
         the one on the company record — not the From address, which may be a
         no-reply sender the provider verified. */
      replyTo: config.identity.email || sender.replyTo,
      ...rendered,
    })
  }

  /* Last, and allowed to fail. The messages have already gone; a report that
     does not arrive costs the office a row on a screen. */
  await getContent()
    .enquiries.report(records)
    .catch((error) => {
      console.error('[mail] the panel was not told what was sent:', error)
    })

  return { officeSent }
}

/**
 * The words, the sender and the two switches — or as much of them as survives.
 *
 * The templates come from the panel and are cached here, which is what makes
 * this site able to write the office's own sentences while the panel is down.
 * When even the cache has nothing, the fallback deliberately sends the office
 * copy only: that message is internal, and a seeded default is far better than
 * silence. The traveller's acknowledgement is not sent, because it carries the
 * company's name and sign-off, and a developer's default in a stranger's inbox
 * is worse than no acknowledgement at all.
 */
async function settings(sender: MailSender): Promise<ApiEnquiryMail> {
  try {
    return await getContent().enquiries.mail()
  } catch (error) {
    console.error(
      '[mail] the wording could not be read from the panel; sending the office copy only:',
      error instanceof Error ? error.message : error,
    )
    return {
      identity: senderIdentity(sender),
      replyPromise: '',
      notifyOffice: true,
      acknowledgeTraveller: false,
      templates: DEFAULT_TEMPLATES.filter(
        (template): template is EmailTemplate => template.kind === 'ENQUIRY_NOTIFICATION',
      ).map((template) => ({ ...template, id: '' })),
    }
  }
}

/**
 * Who the message is from, when there is nothing to ask.
 *
 * Taken apart from `MAIL_FROM`, which is `Name <address>` — configuration this
 * deployment already had to set for the provider to accept anything, and
 * therefore not a company detail typed into a component.
 */
function senderIdentity(sender: MailSender): EmailIdentity {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(sender.from)
  return {
    name: match?.[1]?.replace(/^"|"$/g, '') ?? '',
    email: sender.replyTo || match?.[2] || '',
    phone: '',
    siteUrl: '',
    addressLine: '',
    logoUrl: '',
  }
}

/**
 * The journey's title, for a message that is read by a person.
 *
 * A slug in the office's "Journey" line is legible but wrong-looking, so it is
 * the fallback rather than the answer — and it is a fallback, because this
 * read goes to the panel and the panel may be the reason we are here.
 */
async function tripTitle(slug: string | undefined): Promise<string | undefined> {
  if (!slug) return undefined
  try {
    const trip = await getContent().trips.bySlug(slug)
    return trip?.title ?? slug
  } catch {
    return slug
  }
}
