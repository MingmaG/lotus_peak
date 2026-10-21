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

/**
 * What to say when the enquiry did not arrive for a reason that is not the
 * traveller's to fix. The address is the company's, handed in by the caller
 * from the settings the layout already has — it was a literal here, and would
 * have gone on offering the old address after the office changed it.
 */
function fallback(email: string): string {
  return email
    ? `That did not send. Please write to ${email} and we will pick it up from there.`
    : 'That did not send. Please try again in a little while.'
}

export type EnquiryOutcome = { sent: true } | { sent: false; message: string }

export async function sendEnquiry(
  body: Record<string, unknown>,
  email: string,
): Promise<EnquiryOutcome> {
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
    /* A refusal (4xx) is the server's own words, written for the traveller.
       Anything else — our failure — gets the address to write to instead. */
    if (response.status >= 400 && response.status < 500 && payload?.error) {
      return { sent: false, message: payload.error }
    }
    return { sent: false, message: fallback(email) }
  } catch {
    /* Offline, or the request never left the browser. */
    return { sent: false, message: fallback(email) }
  }
}
