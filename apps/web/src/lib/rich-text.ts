import "server-only";
import { parseVideoSource, thumbnailUrl, watchUrl } from "@lotuspeak/video";
import { siteUrl } from "@/lib/env";

/**
 * Turns the admin panel's rich text into HTML this site is willing to render.
 *
 * Long-form bodies — journal entries, a journey's opening, an editorial page,
 * a teacher's biography — used to cross the wire as a closed union of typed
 * blocks that the site drew as React. Nothing could smuggle markup into a page
 * because nothing could express markup. That guarantee went the moment the
 * office got a rich-text editor, and this module is what replaces it, so it is
 * worth being precise about what it does and does not promise.
 *
 * **It is an allowlist, not a filter.** Nothing is passed through. The input is
 * tokenised, and the output is *rebuilt* from the tags and attributes named
 * below; a tag this module does not know is dropped and its text kept, and an
 * attribute it does not know never reaches the output no matter how it was
 * spelled. That is the important structural property — a filter that tries to
 * remove the dangerous things is a list of everything anybody has thought of,
 * and this is a list of the fourteen elements a journal article needs.
 *
 * **Images are checked twice.** `isAllowedImageSrc` refuses a host that is not
 * the media store named by `MEDIA_PUBLIC_URL` — the same origin
 * `next.config.mjs` puts in `images.remotePatterns` — and then the URL is
 * rewritten through Next's optimizer, so a photograph inside a paragraph gets
 * the AVIF and WebP treatment every other photograph on the site gets.
 *
 * **It assumes the producer is the admin panel.** The office writes this copy,
 * signed in, and this is defence in depth rather than a boundary with an
 * adversary on the other side of it. It is written to hold anyway, because the
 * thing on the other side of a content API has a way of changing.
 */

/* --------------------------------------------------------------- media origin */

/**
 * The hosts a photograph in a body may be served from.
 *
 * One origin: the media store the admin panel uploads to, named by
 * `MEDIA_PUBLIC_URL` and already the only thing in `images.remotePatterns` in
 * `next.config.mjs`. An `<img>` pointing anywhere else — a hotlink somebody
 * pasted, a tracking pixel, a `data:` URI — is refused, because an untrusted
 * image URL is a request the visitor's browser makes on our say-so.
 *
 * Read once at module scope. It is a deployment fact, not a per-request one,
 * and `next.config.mjs` has already refused to build without it.
 */
const ALLOWED_IMAGE_HOSTS: readonly string[] = (() => {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(process.env.MEDIA_PUBLIC_URL ?? "").hostname);
  } catch {
    /* Unset in a test run. Relative paths still work; absolute ones do not,
       which is the safe direction to fail in. */
  }
  try {
    hosts.add(new URL(siteUrl()).hostname);
  } catch {
    /* Ignored: `siteUrl()` has a default and cannot realistically throw. */
  }
  return [...hosts].filter(Boolean);
})();

function isAllowedImageSrc(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const { protocol, hostname } = new URL(src);
    /* http only for a loopback host, which is how the admin panel's local
       storage driver and MinIO serve media in development. Anywhere else an
       image over http is a mixed-content warning and a tampering opportunity. */
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
    if (protocol !== "https:" && !(protocol === "http:" && isLoopback)) return false;
    return ALLOWED_IMAGE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ allowlist */

/**
 * The elements a body may contain, and the attributes each may carry.
 *
 * This is the vocabulary Tiptap emits in the admin panel, and nothing else.
 * `div` is here for the wrapper Tiptap puts around an embedded video and is
 * allowed no attributes at all. `iframe` is in the list so that the one the
 * editor inserts is recognised — but none is ever written out: a YouTube embed
 * is rebuilt as a façade (see `videoFacade`), and anything else is dropped.
 */
const ALLOWED: Record<string, readonly string[]> = {
  p: ["style"],
  h2: ["style"],
  h3: ["style"],
  h4: ["style"],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  strike: [],
  code: [],
  pre: [],
  blockquote: [],
  ul: [],
  ol: ["start"],
  li: [],
  a: ["href"],
  img: ["src", "alt", "title"],
  hr: [],
  br: [],
  table: [],
  thead: [],
  tbody: [],
  tfoot: [],
  tr: [],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
  figure: [],
  figcaption: [],
  div: [],
  iframe: ["src", "width", "height", "allowfullscreen", "title"],
};

/** Elements that never have children and are written self-closing. */
const VOID = new Set(["img", "hr", "br"]);

/**
 * Elements whose *contents* are dropped along with the tag.
 *
 * For everything else an unknown tag is unwrapped — `<span>bold</span>` keeps
 * "bold" — because a body that loses a word to an unrecognised wrapper is a
 * silent content bug. For these, the text between the tags is the payload.
 */
const DROP_CONTENTS = new Set(["script", "style", "noscript", "template", "svg", "math"]);

/* ---------------------------------------------------------------- attributes */

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A link this site will render.
 *
 * Root-relative and fragment links are ours. An absolute URL must be http(s)
 * or mailto — which refuses `javascript:` and `data:` by naming what is
 * allowed rather than by listing what is not, so a novel scheme is refused
 * too.
 */
function safeHref(value: string): string | null {
  const href = value.trim();
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;

  try {
    const { protocol } = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(protocol) ? href : null;
  } catch {
    return null;
  }
}

/**
 * An embedded film, as a façade rather than as the iframe the editor wrote.
 *
 * The rich-text editor inserts a YouTube iframe, and a body that carries three
 * of them used to carry three players: something like half a megabyte of
 * third-party JavaScript each, running on a page whose visitor came to read.
 * `loading="lazy"` only moved that cost to the scroll, which is the worst
 * moment for it.
 *
 * What is written out instead is the same façade `VideoEmbed` renders — a
 * thumbnail, a play button and a real link to the film — with the original URL
 * on a data attribute. `VideoFacadeScript` swaps the player in on the click,
 * and until then an article with films in it costs one image each.
 *
 * Returns null for an iframe pointing at anything this site will not embed,
 * which the caller drops.
 */
function videoFacade(attrs: Map<string, string>): string | null {
  const source = parseVideoSource(attrs.get("src") ?? "");
  if (!source || source.kind === "file") return null;

  const href = watchUrl(source);
  if (!href) return null;

  const poster = thumbnailUrl(source);
  const title = attrs.get("title")?.trim() || "Watch the film";

  return (
    `<div class="video-facade" data-video-facade data-video-src="${escapeAttr(href)}"` +
    ` data-video-title="${escapeAttr(title)}">` +
    `<a class="video-facade-link" href="${escapeAttr(href)}"` +
    ` target="_blank" rel="noopener noreferrer">` +
    (poster
      ? `<img class="video-facade-poster" src="${escapeAttr(poster)}" alt=""` +
        ` width="480" height="360" loading="lazy" decoding="async">`
      : "") +
    `<span class="video-facade-scrim"></span>` +
    `<span class="video-facade-play" aria-hidden="true"></span>` +
    `<span class="lp-sr-only">${escapeText(title)}</span>` +
    `</a></div>`
  );
}

/**
 * The widths the article images are served at.
 *
 * Every one is in Next's default `deviceSizes`, because the optimizer answers
 * 400 for a width that is not — an in-article photograph would then be the one
 * broken image on an otherwise fine page.
 */
const IMAGE_WIDTHS = [640, 828, 1080, 1920] as const;
const IMAGE_FALLBACK_WIDTH = 1200;

/** The body column is 700px at full width; below that the photo is the page. */
const IMAGE_SIZES = "(max-width: 900px) 100vw, 700px";

function optimizedUrl(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

/**
 * An in-article photograph, or null when its host is not allowlisted.
 *
 * Built rather than patched: the optimizer URL, a srcset and the loading hints
 * are written here, so an `<img>` from the editor arrives with the same
 * treatment `next/image` gives every other photograph on the site.
 */
function imageTag(attrs: Map<string, string>): string | null {
  const src = attrs.get("src")?.trim();
  if (!src || !isAllowedImageSrc(src)) {
    if (src) console.warn("[rich-text] refused image from an untrusted host:", src);
    return null;
  }

  const alt = attrs.get("alt") ?? "";
  const srcset = IMAGE_WIDTHS.map((w) => `${optimizedUrl(src, w)} ${w}w`).join(", ");

  return (
    `<img src="${escapeAttr(optimizedUrl(src, IMAGE_FALLBACK_WIDTH))}"` +
    ` srcset="${escapeAttr(srcset)}"` +
    ` sizes="${IMAGE_SIZES}"` +
    ` alt="${escapeAttr(alt)}" loading="lazy" decoding="async">`
  );
}

/** `text-align`, and nothing else, from a `style` the editor wrote. */
function safeStyle(value: string): string | null {
  const match = /text-align:\s*(left|right|center|justify)/i.exec(value);
  return match ? `text-align:${match[1]!.toLowerCase()}` : null;
}

/** A positive integer, for `colspan`, `rowspan` and an ordered list's `start`. */
function safeInteger(value: string): string | null {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isInteger(n) && n > 0 && n < 1000 ? String(n) : null;
}

/**
 * The attributes an element keeps, rebuilt one at a time.
 *
 * Returns null for an element that cannot be rendered at all — a link with a
 * `javascript:` href — which the caller unwraps rather than drops, so the
 * link's text survives as text. An iframe never reaches here: it is rebuilt as
 * a façade before this is called.
 */
function attributesFor(tag: string, attrs: Map<string, string>): string | null {
  const allowed = ALLOWED[tag] ?? [];
  let out = "";

  for (const name of allowed) {
    const raw = attrs.get(name);
    if (raw === undefined) continue;

    if (name === "href") {
      const href = safeHref(raw);
      if (!href) return null;
      // An outbound link gets the rel every outbound link on this site gets.
      const external = /^https?:\/\//i.test(href);
      out += ` href="${escapeAttr(href)}"`;
      if (external) out += ` target="_blank" rel="noopener noreferrer"`;
      continue;
    }

    if (name === "style") {
      const style = safeStyle(raw);
      if (style) out += ` style="${escapeAttr(style)}"`;
      continue;
    }

    if (name === "colspan" || name === "rowspan" || name === "start" || name === "width" || name === "height") {
      const n = safeInteger(raw);
      if (n) out += ` ${name}="${n}"`;
      continue;
    }

    if (name === "allowfullscreen") {
      out += " allowfullscreen";
      continue;
    }

    out += ` ${name}="${escapeAttr(raw)}"`;
  }

  return out;
}

/* ----------------------------------------------------------------- tokenising */

const TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>|<!--[\s\S]*?-->|[^<]+|</g;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseAttributes(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw.trim()) return out;

  ATTR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR.exec(raw)) !== null) {
    const name = match[1]!.toLowerCase();
    // First spelling wins, so a duplicate cannot override a checked value.
    if (!out.has(name)) out.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return out;
}

/**
 * Text between tags, re-escaped.
 *
 * The input is already HTML, so `&amp;` is decoded and re-encoded rather than
 * doubled — otherwise "Paro &amp; Thimphu" would render as "Paro &amp;amp;
 * Thimphu" after a round trip. Everything else is escaped, which is what makes a
 * stray `<` in the copy text rather than the start of a tag.
 */
function escapeText(text: string): string {
  return text
    .replace(/&(?![a-zA-Z][a-zA-Z0-9]{1,9};|#\d{1,6};|#x[0-9a-fA-F]{1,6};)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sanitises a rich-text body into HTML that is safe to set as inner HTML.
 *
 * Unbalanced input is closed off rather than rejected: the stack is unwound at
 * the end, so a body that was truncated somewhere upstream renders as much of
 * itself as it has instead of breaking the page it is on.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";

  let out = "";
  /** Open elements that were written to the output, innermost last. */
  const open: string[] = [];
  /** When set, everything up to this element's closing tag is dropped. */
  let dropping: string | null = null;

  TOKEN.lastIndex = 0;
  let token: RegExpExecArray | null;

  while ((token = TOKEN.exec(html)) !== null) {
    const [raw, name] = token;

    // Text, a comment, or a bare "<" that starts no tag.
    if (name === undefined) {
      if (dropping || raw.startsWith("<!--")) continue;
      out += raw === "<" ? "&lt;" : escapeText(raw);
      continue;
    }

    const tag = name.toLowerCase();
    const closing = raw.startsWith("</");

    if (dropping) {
      if (closing && tag === dropping) dropping = null;
      continue;
    }

    if (DROP_CONTENTS.has(tag)) {
      if (!closing && !raw.endsWith("/>")) dropping = tag;
      continue;
    }

    if (closing) {
      // Close back to this element, if it is open at all. An unmatched closing
      // tag is ignored rather than closing something it did not open.
      const at = open.lastIndexOf(tag);
      if (at === -1) continue;
      while (open.length > at) out += `</${open.pop()}>`;
      continue;
    }

    if (!(tag in ALLOWED)) continue; // Unwrapped: the children still render.

    const attrs = parseAttributes(token[2] ?? "");

    if (tag === "img") {
      const img = imageTag(attrs);
      if (img) out += img;
      continue;
    }

    // An embed is replaced by its façade and never opened, so the `</iframe>`
    // that follows finds nothing on the stack and is ignored — which is what
    // should happen to it.
    if (tag === "iframe") {
      const facade = videoFacade(attrs);
      if (facade) out += facade;
      continue;
    }

    const rendered = attributesFor(tag, attrs);
    if (rendered === null) continue; // Unrenderable: unwrap and keep the text.

    if (VOID.has(tag)) {
      out += `<${tag}${rendered}>`;
      continue;
    }

    out += `<${tag}${rendered}>`;
    open.push(tag);
  }

  while (open.length) out += `</${open.pop()}>`;

  return out;
}

const TABLE_OPEN = /<table(\s|>)/gi;
const TABLE_CLOSE = /<\/table>/gi;

/**
 * Sanitises, and wraps each table so it scrolls inside its own column.
 *
 * Stored bodies carry a bare `<table>`. A table wider than the text measure has
 * nothing to scroll inside and pushes the whole page out sideways on a phone,
 * which is the one layout bug that makes a page unreadable rather than untidy.
 */
export function renderRichText(html: string | null | undefined): string {
  const safe = sanitizeRichText(html);
  if (!safe.includes("<table")) return safe;

  TABLE_OPEN.lastIndex = 0;
  TABLE_CLOSE.lastIndex = 0;

  return safe
    .replace(TABLE_OPEN, (_match, next: string) => `<div class="table-scroll"><table${next}`)
    .replace(TABLE_CLOSE, "</table></div>");
}

/**
 * A tag — the thing that tells markup from a sentence somebody typed.
 *
 * Deliberately strict about what follows the `<`: a letter and then a word, so
 * that "under 3 < 4 hours" is a sentence and `<p>` is markup. It does not
 * matter which tag it is; the sanitiser decides that.
 */
const HAS_TAG = /<[a-z][a-z0-9]*\b[^>]*>/i;

/**
 * Rich text from a column that may hold either markup or a typed sentence.
 *
 * Several fields moved to the rich-text editor after they had already been
 * filled in — an itinerary day's description, an answer in a question list —
 * so one row in the table is `<p>…</p><ul>…` and the next is a paragraph of
 * plain text somebody typed into a box years ago. Both are correct, both are
 * what the office wrote, and a renderer has to draw each of them as prose.
 *
 * Markup goes through the sanitiser unchanged. Plain text is wrapped — blank
 * lines make paragraphs, and everything in it is escaped on the way through,
 * so a `<` in a sentence stays a `<` rather than becoming the start of a tag
 * this module then has an opinion about.
 *
 * This is the function to use for **any** stored body that predates its
 * editor. {@link renderRichText} is for the columns that have only ever held
 * HTML.
 */
export function renderStoredRichText(value: string | null | undefined): string {
  if (!value) return "";
  if (HAS_TAG.test(value)) return renderRichText(value);

  const paragraphs = value
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    // A single newline inside a paragraph is a line the writer broke, not a
    // new paragraph — which is what a `<textarea>` gave them no other way to
    // say.
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`);

  return renderRichText(paragraphs.join(""));
}

/** Whether a body has anything in it once the markup is taken out. */
export function hasRichText(html: string | null | undefined): boolean {
  if (!html) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

/**
 * The words in a body, with the markup taken out.
 *
 * For the places that have to summarise a body rather than draw it — a meta
 * description, a JSON-LD description, the lead line on a sibling card.
 */
export function toPlainText(html: string | null | undefined): string {
  if (!html) return "";

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // A film's façade carries a visually-hidden label for the link. It is
    // navigation, not prose, and a meta description that opens "Watch the
    // film" is describing the page's furniture.
    .replace(/<div class="video-facade"[\s\S]*?<\/div>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
