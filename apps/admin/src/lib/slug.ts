import slugify from 'slugify';

/**
 * A URL segment from a title.
 *
 * `strict` drops everything that is not a letter, a digit or a hyphen, which
 * matters here more than usual: the content is full of apostrophes
 * ("Travellers' information") and middots, and a slug carrying either is a
 * slug that is escaped differently by every client that touches it.
 */
export function toSlug(input: string): string {
  return slugify(input, { lower: true, strict: true, trim: true });
}

/**
 * Makes a slug unique against the ones already taken.
 *
 * Appends `-2`, `-3` and so on rather than a random suffix, because a slug is
 * a URL somebody will read out and `sacred-valleys-2` is readable in a way
 * that `sacred-valleys-8fkq` is not.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = toSlug(base) || 'untitled';
  if (!used.has(root)) return root;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** A page path from a slug. Always absolute, never with a trailing slash. */
export function toPath(slug: string): string {
  const clean = toSlug(slug);
  return clean === 'home' ? '/' : `/${clean}`;
}
