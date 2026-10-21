import 'server-only'

/**
 * Handing one message to Resend.
 *
 * ## Why this lives on the website and not in the panel
 *
 * It used to be in the panel, next to the row it was writing. That made the
 * office's notification a casualty of anything that took the panel down — a
 * restart, a migration, a half-finished deploy, a database that would not
 * answer — and a traveller who fills in a form during one of those is a
 * traveller nobody ever hears from. Sending from here decouples the two: the
 * enquiry still tries to reach the panel first, and it reaches a human inbox
 * whether or not it got there.
 *
 * The record of what was sent still belongs to the panel, and goes to it
 * afterwards. See `mail/enquiry.ts`.
 *
 * ## Why `fetch` and not the SDK
 *
 * The request is one POST. `resend` would be a dependency, a version to keep
 * up and a wrapper over the same call; swapping in Postmark or Brevo means
 * rewriting {@link handOver} alone. §7 of the monorepo's rules says not to add
 * a dependency for what a small module does, and this is that module.
 *
 * ## Why an API and not SMTP
 *
 * A fresh server's IP has no sending reputation and cannot sign as the
 * company's domain, so mail either lands in spam or is refused outright. The
 * provider signs with DKIM for the domain instead.
 */

const ENDPOINT = 'https://api.resend.com/emails'

/** Long enough for a slow provider, short enough not to hold a request open. */
const TIMEOUT_MS = 10_000

export interface MailSender {
  /** Unset means render and record rather than send. See {@link mailConfigured}. */
  apiKey: string
  /** The verified sending identity, e.g. `Lotus Peak <info@lotuspeak.org>`. */
  from: string
  /** Where a traveller's reply goes when nothing better is known. */
  replyTo: string
  /** Where the office's copy of an enquiry goes. One or more addresses. */
  officeTo: string[]
}

/**
 * Read at the point it means something, not at module load.
 *
 * Every page of this site is prerendered, and a module-level read of a mail
 * variable would run during the build — where it is neither set nor needed —
 * and turn a missing address into a failed build of eleven static pages.
 */
export function mailSender(): MailSender {
  return {
    apiKey: (process.env.RESEND_API_KEY ?? '').trim(),
    from: (process.env.MAIL_FROM ?? '').trim(),
    replyTo: (process.env.MAIL_REPLY_TO ?? '').trim(),
    officeTo: (process.env.MAIL_OFFICE_TO ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean),
  }
}

/**
 * True when a message will actually leave this server.
 *
 * Unset is the correct development default: a fixture full of test addresses
 * must not be able to email anybody, and a sender that threw when
 * unconfigured would make every enquiry in development look like a failure.
 * The message is still rendered and still reported, so the wording can be read
 * on the panel's Email screen before a key is ever set.
 */
export function mailConfigured(sender = mailSender()): boolean {
  return sender.apiKey.length > 0 && sender.from.length > 0
}

export interface OutgoingEmail {
  to: string
  /** Where the recipient's "Reply" goes. Not the same as the From address. */
  replyTo: string
  subject: string
  html: string
  text: string
}

/**
 * The one POST. Returns Resend's id for the message.
 *
 * That id is what a delivery or bounce notice arrives quoting, so losing it
 * costs the message its later history on the panel — but the mail did go, so a
 * body that does not parse is swallowed rather than thrown.
 */
export async function handOver(
  message: OutgoingEmail,
  sender = mailSender(),
): Promise<string | null> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sender.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: sender.from,
      to: [message.to],
      reply_to: message.replyTo || sender.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
    /* Never let a hanging provider hold a request open. Without this the fetch
       has no deadline at all and an enquiry submission waits on it. */
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 400)}`)
  }

  try {
    const body = (await response.json()) as { id?: unknown }
    return typeof body.id === 'string' ? body.id : null
  } catch {
    return null
  }
}
