import { SignJWT, jwtVerify } from 'jose';

import { env } from '@/lib/env';

/**
 * A ticket to see one unpublished thing.
 *
 * ## Why not just let the admin panel render a preview
 *
 * Because a reimplemented preview drifts. drokpo's admin draws its own copy of
 * the page in a preview pane, and every design change is then two changes —
 * one of which nobody makes, because nothing breaks when they do not. The
 * preview slowly stops being a preview.
 *
 * So the preview *is* the website. The admin panel signs a token and opens
 * `/api/preview` on the site, which turns on Next's draft mode and renders the
 * real page from unpublished rows, through the real components, with the real
 * motion. Inside the panel it is that URL in an iframe at phone, tablet and
 * desktop widths.
 *
 * ## Why it is signed and short
 *
 * The site's whole safety property is that it cannot see a draft. This is the
 * one hole in that, so the hole is as small as it can be: fifteen minutes,
 * scoped to one path, and signed with a secret that is not the session secret
 * — a leaked preview link is fifteen minutes of one unpublished page, not a
 * way into anything.
 */

const ISSUER = 'lotuspeak-admin';
const AUDIENCE = 'preview';

const key = new TextEncoder().encode(env.site.previewSecret);

export interface PreviewClaims {
  /** The path on the website this token is good for. */
  path: string;
  /** Who asked, for the log. */
  sub: string;
}

export async function signPreviewToken(claims: PreviewClaims): Promise<string> {
  return new SignJWT({ path: claims.path })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setExpirationTime('15m')
    .sign(key);
}

export async function verifyPreviewToken(token: string): Promise<PreviewClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return { path: String(payload.path ?? ''), sub: String(payload.sub ?? '') };
  } catch {
    return null;
  }
}
