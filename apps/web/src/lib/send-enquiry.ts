/**
 * Posting an enquiry, and finding out whether it arrived.
 *
 * Shared by the contact page, the trip-detail form and the drawer, because all
 * three used to do this:
 *
 * ```
 *   await fetch('/api/enquiries', …).catch(() => {})
 *   onSent()
 * ```
 *
 * — which announces "Sent. We will write back within two days." whether the
 * server wrote the enquiry, refused it or was never reached. An enquiry is the
 * only thing this website is for, and a traveller who is told theirs is on its
 * way does not send it again. So the answer is read, and the caller is told
 * what actually happened.
 */

const FALLBACK =
  'That did not send. Please write to info@lotuspeak.org and we will pick it up from there.'

export type EnquiryOutcome = { sent: true } | { sent: false; message: string }

export async function sendEnquiry(body: Record<string, unknown>): Promise<EnquiryOutcome> {
  try {
    const response = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null

    if (response.ok && payload?.ok === true) return { sent: true }
    return { sent: false, message: payload?.error ?? FALLBACK }
  } catch {
    /* Offline, or the request never left the browser. */
    return { sent: false, message: FALLBACK }
  }
}
