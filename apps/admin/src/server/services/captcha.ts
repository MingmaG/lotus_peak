import 'server-only';

import { env } from '@/lib/env';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * What Cloudflare said about a Turnstile token.
 *
 * `unreachable` is its own answer rather than a `false`, because the two are
 * handled oppositely: a token Cloudflare refuses is refused, and a check that
 * could not be made at all lets the enquiry through.
 */
export type CaptchaVerdict = 'passed' | 'failed' | 'unreachable';

/**
 * Asks Cloudflare whether a token from the form's check is genuine.
 *
 * A token is good for one verification, which is why only this panel asks:
 * the website forwards the token rather than spending it, and a second
 * question about the same token is answered "duplicate".
 *
 * **Failing open when Cloudflare cannot be reached is deliberate.** Turnstile
 * is there to keep spam rows out of a table; an enquiry nobody is told about
 * is the one failure this site cannot have. An outage at Cloudflare should
 * cost the office a few minutes of unchecked enquiries, not a few minutes of
 * travellers refused — the honeypot, the rate limit and the length caps are
 * all still in front of it.
 */
export async function verifyCaptcha(token: string, remoteIp: string | null): Promise<CaptchaVerdict> {
  const form = new URLSearchParams({ secret: env.captcha.secretKey, response: token });
  if (remoteIp) form.set('remoteip', remoteIp);

  try {
    const response = await fetch(SITEVERIFY, {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      console.error('[captcha] siteverify answered', response.status);
      return 'unreachable';
    }
    const result = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (result.success === true) return 'passed';

    /* Our own misconfiguration is not the traveller's failure. A secret
       Cloudflare does not recognise would otherwise refuse every enquiry
       with a message telling the traveller to try the check again. */
    const codes = result['error-codes'] ?? [];
    if (codes.some((code) => code.includes('secret'))) {
      console.error('[captcha] Cloudflare refused our secret key:', codes.join(', '));
      return 'unreachable';
    }
    return 'failed';
  } catch (error) {
    console.error('[captcha] siteverify could not be reached', error);
    return 'unreachable';
  }
}
