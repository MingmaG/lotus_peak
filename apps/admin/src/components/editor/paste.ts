/**
 * Making a paste land the way the office expects it to.
 *
 * Almost nothing is typed into this editor from scratch. An itinerary day
 * arrives from a Word document, a journal entry from Google Docs, and — more
 * and more — a first draft from a chat with an AI assistant, which puts
 * Markdown on the clipboard as plain text and a wall of `<span style>` on it
 * as HTML. TipTap handles a clean paste well and handles both of those badly:
 * the HTML keeps a font stack and a background colour from whatever theme the
 * assistant was rendered in, and the plain text arrives as one paragraph with
 * `## ` and `**bold**` still visible in it.
 *
 * Two passes, then:
 *
 * - `cleanPastedHtml` throws away presentation and keeps structure. The schema
 *   would drop the unknown attributes anyway; what it would *not* drop is a
 *   `<span>` wrapping every word, which survives as a nest of empty marks.
 * - `markdownToHtml` is used only when the clipboard has no HTML at all and
 *   the text is unmistakably Markdown. Guessing on ordinary prose would be
 *   worse than not trying: an itinerary line that happens to start with `- `
 *   is a list, but a price that contains `*` is not emphasis.
 *
 * Neither of these is a sanitiser. What may exist in the document is decided
 * by the TipTap schema, and what may be published is decided again on the
 * server — see `src/server/schema/rich-text.ts`.
 */

/** Attributes worth keeping. Everything else on a pasted element is styling. */
const KEEP_ATTRIBUTES = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan']);

/**
 * Elements that carry no meaning once their styling is gone.
 *
 * Unwrapped rather than removed: the words inside them are the paste.
 */
const UNWRAP = new Set(['SPAN', 'FONT', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER']);

/** Elements that are never content. */
const DROP = new Set(['STYLE', 'SCRIPT', 'META', 'LINK', 'NOSCRIPT', 'BUTTON', 'SVG']);

export function cleanPastedHtml(html: string): string {
  if (typeof window === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const node of Array.from(doc.body.querySelectorAll('*'))) {
    if (DROP.has(node.tagName)) {
      node.remove();
      continue;
    }

    for (const attribute of Array.from(node.attributes)) {
      if (!KEEP_ATTRIBUTES.has(attribute.name.toLowerCase())) {
        node.removeAttribute(attribute.name);
      }
    }
  }

  /**
   * Unwrapping runs last and bottom-up.
   *
   * Top-down would detach a `<div>` still holding the `<span>`s that were
   * about to be unwrapped, and they would leave with it.
   */
  for (const node of Array.from(doc.body.querySelectorAll('*')).reverse()) {
    if (!UNWRAP.has(node.tagName)) continue;
    /* A div between table rows is structural; unwrapping it breaks the table. */
    if (node.closest('table')) continue;
    node.replaceWith(...Array.from(node.childNodes));
  }

  return doc.body.innerHTML;
}

/**
 * Whether plain text is Markdown rather than prose that happens to have
 * punctuation in it.
 *
 * Deliberately hard to satisfy. A fenced code block or an ATX heading is
 * conclusive; anything else needs two different constructs to agree, because
 * one bullet in a paragraph is a dash and one asterisk is a footnote marker.
 */
export function looksLikeMarkdown(text: string): boolean {
  if (/^```/m.test(text)) return true;
  if (/^#{1,6}\s+\S/m.test(text)) return true;

  const signals = [
    /^[-*+]\s+\S/m, // bullet list
    /^\d+\.\s+\S/m, // numbered list
    /\*\*[^*\n]+\*\*/, // bold
    /^>\s+\S/m, // quote
    /\[[^\]\n]+\]\([^)\s]+\)/, // link
    /^\|.+\|$/m, // table row
  ].filter((pattern) => pattern.test(text));

  return signals.length >= 2;
}

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function escape(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ESCAPE[character] ?? character);
}

/** Bold, italic, inline code and links, in that order of precedence. */
function inline(text: string): string {
  const codes: string[] = [];

  /* Code spans are extracted first and put back last, so `**` inside one is
     not read as emphasis — which is exactly how a Markdown renderer behaves,
     and how an editor pasting a shell command would expect it to. */
  let out = text.replace(/`([^`\n]+)`/g, (_, code: string) => {
    codes.push(`<code>${escape(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = escape(out);

  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) =>
    /^(https?:|\/|mailto:|tel:)/i.test(href)
      ? `<a href="${escape(href)}">${label}</a>`
      : label,
  );
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  return out.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)] ?? '');
}

/**
 * Enough Markdown to carry a draft across, and no more.
 *
 * Headings, both list kinds, quotes, fenced code, tables, rules, and the inline
 * marks. Not footnotes, not definition lists, not front matter — the point is a
 * paste that lands as the right shapes, which somebody then edits here.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';

    /* Fenced code, taken verbatim to the closing fence. */
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      index += 1;
      out.push(`<pre><code>${escape(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      /* H1 is the record's own title field, so a pasted `#` becomes an H2 and
         everything below it shifts with it. Six clamps to four, which is as
         deep as the site's typography goes. */
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    /* A table: a header row, a delimiter row, then body rows. */
    if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? '')) {
      const cells = (row: string) =>
        row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

      const head = cells(line);
      index += 2;

      const body: string[][] = [];
      while (index < lines.length && /^\|.*\|\s*$/.test(lines[index] ?? '')) {
        body.push(cells(lines[index] ?? ''));
        index += 1;
      }

      const headHtml = head.map((cell) => `<th>${inline(cell)}</th>`).join('');
      const bodyHtml = body
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
        .join('');
      out.push(`<table><tbody><tr>${headHtml}</tr>${bodyHtml}</tbody></table>`);
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet ?? numbered) {
      const ordered = numbered !== null;
      const pattern = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      const items: string[] = [];
      while (index < lines.length) {
        const match = pattern.exec(lines[index] ?? '');
        if (!match?.[1] && match?.[1] !== '') break;
        items.push(`<li><p>${inline(match[1])}</p></li>`);
        index += 1;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      const body: string[] = [];
      while (index < lines.length) {
        const match = /^>\s?(.*)$/.exec(lines[index] ?? '');
        if (!match) break;
        body.push(match[1] ?? '');
        index += 1;
      }
      out.push(`<blockquote><p>${inline(body.join(' '))}</p></blockquote>`);
      continue;
    }

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    /* A paragraph runs to the next blank line or the next block construct. */
    const paragraph: string[] = [];
    while (index < lines.length) {
      const next = lines[index] ?? '';
      if (
        next.trim() === '' ||
        /^(#{1,6}\s|```|>\s?|\s*[-*+]\s|\s*\d+\.\s|\|)/.test(next) ||
        /^(\s*[-*_]){3,}\s*$/.test(next)
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  return out.join('');
}
