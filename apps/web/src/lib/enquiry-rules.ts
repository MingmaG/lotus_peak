import { ENQUIRY_LIMITS, countWords, isPhoneNumber } from '@lotuspeak/api-contracts'

/**
 * What an enquiry has to satisfy before it is sent, as messages keyed by the
 * field they belong to.
 *
 * One function for the three forms and for `/api/enquiries`, so a form never
 * passes what the route refuses — the limits themselves come from the
 * contract, which is what the panel checks as well. The forms run it to put
 * the message under the field; the route runs it because it is reachable
 * without a form.
 */
export function enquiryErrors(
  fields: Record<string, unknown>,
  { captcha }: { captcha: boolean },
): Record<string, string> {
  const text = (key: string) => String(fields[key] ?? '').trim()
  const errors: Record<string, string> = {}

  const name = text('name')
  if (name.length < 2 || name.length > 100) errors.name = 'We need a name to write back to.'

  const email = text('email')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    errors.email = 'That email does not look right.'
  }

  const phone = text('phone')
  if (phone && !isPhoneNumber(phone)) {
    errors.phone = `A telephone number, with its country code: ${ENQUIRY_LIMITS.phoneDigits.min} to ${ENQUIRY_LIMITS.phoneDigits.max} digits.`
  }

  for (const key of ['adults', 'children'] as const) {
    const raw = text(key)
    if (!raw) continue
    const { min, max } = ENQUIRY_LIMITS[key]
    const n = Number(raw)
    if (!Number.isInteger(n) || n < min || n > max) errors[key] = `A whole number from ${min} to ${max}.`
  }

  const words = countWords(text('message'))
  if (words > ENQUIRY_LIMITS.messageWords) {
    errors.message = `Please keep it to ${ENQUIRY_LIMITS.messageWords} words — this is ${words}.`
  }

  if (captcha && !text('captchaToken')) {
    errors.captchaToken = 'Please complete the check above the button.'
  }

  return errors
}
