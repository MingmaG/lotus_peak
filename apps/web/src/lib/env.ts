/**
 * The environment, read once.
 *
 * Not ceremony. `(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lotuspeak.org')
 * .replace(/\/$/, '')` was written out in six places, and the sixth — the root
 * layout's `metadataBase` — read `SITE_URL`, which is the *admin panel's*
 * variable name and is not set here. It fell through to the production default,
 * so on a developer's machine and on staging every Open Graph image resolved
 * against lotuspeak.org. Nothing failed; it was simply wrong somewhere nobody
 * looks.
 *
 * Everything else on this side still reads `process.env` where it is used, and
 * that is fine — those are read once each, at the point they mean something.
 * This file is for the values that are read in more than one place, because
 * that is where they drift.
 */

/**
 * The site's own origin. Absolute, no trailing slash.
 *
 * Canonicals, the sitemap, the feed and every JSON-LD `@id` are built from it,
 * and an `@id` that changes between renders is not an identifier.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lotuspeak.org').replace(/\/$/, '')
}
