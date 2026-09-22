/**
 * Rich text → markdown, for `llms-full.txt`.
 *
 * A generative engine reads markdown. Everywhere else in this package a body
 * is flattened with `plain()` — the tags come out and the words stay — and for
 * a one-paragraph field that is the right trade: a link whose text is its own
 * URL reads worse to a model than the sentence without it.
 *
 * A journal entry is not a one-paragraph field. It has headings that say what
 * the next six paragraphs are about, lists that are lists of things, and
 * tables of fees and opening hours that are the single most liftable fact on
 * the page. Flattening those produces a wall of prose in which "Adult SDF 100
 * USD per night Child 50" is one sentence, and a model asked what the fee is
 * has to guess which number goes with which row.
 *
 * So: structure is kept, and only structure. Emphasis and links are dropped,
 * as they are everywhere else in this file, because they carry nothing a model
 * needs and cost it tokens.
 *
 * Thirty-odd lines rather than a markdown dependency, per `CLAUDE.md`. It only
 * has to handle what the editor emits, which is a short list.
 */

/** Text between tags, with the entities a body actually contains resolved. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&apos;/g, '’')
    .replace(/[ \t\n]+/g, ' ')
    .trim();
}

/** The cells of one row, in order, with each cell flattened. */
function cells(row: string): string[] {
  const out: string[] = [];
  const cell = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = cell.exec(row)) !== null) out.push(text(match[2] ?? ''));
  return out;
}

/** Whether every cell in a row is a `<th>`. */
function allHeaderCells(row: string): boolean {
  const tags = row.match(/<t[hd]\b/gi) ?? [];
  return tags.length > 0 && tags.every((tag) => tag.toLowerCase() === '<th');
}

function tableToMarkdown(html: string): string {
  const rows: string[][] = [];
  /* Whether the first row is a header row, which is a question about its cells
     and not about the table: the editor writes a header row as five `<th>` and
     no `<thead>`, and a label-and-value table writes `<th>` in the first column
     of *every* row. */
  let headerFirst = false;
  const row = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = row.exec(html)) !== null) {
    const raw = match[1] ?? '';
    const values = cells(raw);
    if (values.length === 0) continue;
    if (rows.length === 0) headerFirst = allHeaderCells(raw);
    rows.push(values);
  }
  if (rows.length === 0) return '';

  /* The widest row decides the column count, so a row with a merged cell does
     not truncate the table — a short row is padded rather than dropped. */
  const width = Math.max(...rows.map((cols) => cols.length));
  const pad = (cols: string[]) => [...cols, ...Array(width - cols.length).fill('')];

  /**
   * Markdown insists on a header row, so a table that has none gets an empty
   * one rather than a promoted first row.
   *
   * That matters for the label-and-value tables the journal is full of — fees,
   * opening hours — which carry a `<th>` in the *first column of every row*.
   * Promoting their first row would make "Adult · Nu 500" the column titles
   * and lose a fee, which is precisely the fact somebody asked the model for.
   */
  const hasHead = headerFirst || /<thead\b/i.test(html);
  const head = hasHead ? pad(rows[0] ?? []) : Array<string>(width).fill('');
  const body = hasHead ? rows.slice(1) : rows;

  const lines = [
    `| ${head.join(' | ')} |`,
    `|${' --- |'.repeat(width)}`,
    ...body.map((cols) => `| ${pad(cols).join(' | ')} |`),
  ];
  return `${lines.join('\n')}\n`;
}

function listToMarkdown(html: string, ordered: boolean): string {
  const items: string[] = [];
  const item = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = item.exec(html)) !== null) items.push(text(match[1] ?? ''));

  return items
    .filter(Boolean)
    .map((line, index) => (ordered ? `${index + 1}. ${line}` : `- ${line}`))
    .join('\n')
    .concat('\n');
}

/**
 * The top-level blocks of a body, in order, each as markdown.
 *
 * Deliberately only looks at the outermost elements. A `<strong>` inside a
 * paragraph is flattened by `text()`; a `<ul>` inside a `<li>` is flattened
 * with its parent, which loses one level of nesting in the two places on this
 * site that have one and is not worth a parser to fix.
 */
const BLOCK =
  /<(h2|h3|h4|p|ul|ol|blockquote|pre|table|figure|hr)\b([^>]*)>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;

export function richTextToMarkdown(html: string | null | undefined): string {
  if (!html) return '';

  const out: string[] = [];
  BLOCK.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = BLOCK.exec(html)) !== null) {
    const tag = (match[1] ?? 'hr').toLowerCase();
    const attrs = match[2] ?? '';
    const inner = match[3] ?? '';

    switch (tag) {
      case 'h2':
        out.push(`### ${text(inner)}\n`);
        break;
      case 'h3':
        out.push(`#### ${text(inner)}\n`);
        break;
      /* An h4 on this site is the uppercase label above a table, not a fifth
         level of heading. Bold is the closer equivalent and does not push a
         document to five levels of nesting. */
      case 'h4':
        out.push(`**${text(inner)}**\n`);
        break;
      case 'p': {
        const line = text(inner);
        if (line) out.push(`${line}\n`);
        break;
      }
      case 'ul':
        out.push(listToMarkdown(inner, false));
        break;
      case 'ol':
        out.push(listToMarkdown(inner, true));
        break;
      case 'blockquote':
        out.push(
          `${text(inner)
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n')}\n`,
        );
        break;
      case 'pre':
        out.push('```\n' + text(inner) + '\n```\n');
        break;
      case 'table':
        out.push(tableToMarkdown(inner));
        break;
      case 'figure': {
        /* A model cannot see the photograph, and a markdown image would leave
           it with a URL and nothing else. What is useful is what the office
           wrote about it — the caption first, because that is the sentence
           written for a reader, and the description as the fallback. */
        const caption = /data-caption="([^"]*)"/i.exec(attrs)?.[1];
        const title = /data-title="([^"]*)"/i.exec(attrs)?.[1];
        /* `data-alt` is the description the office wrote for this photograph
           in this entry; the `<img>`'s is the library's, filled in on the way
           out. Most figures carry only the second — an entry that has never
           been re-described since it was imported — and reading only the first
           is how every photograph silently vanished from this file. */
        const alt =
          /data-alt="([^"]*)"/i.exec(attrs)?.[1] ??
          /<img\b[^>]*\balt="([^"]*)"/i.exec(inner)?.[1];
        const film = /data-video="([^"]*)"/i.test(attrs);
        /* A film's title is its name and is usually the only thing written
           about it; a photograph's is a hover line and says least. Hence the
           different order of preference for the two. */
        const label = text((film ? (caption ?? title) : (caption ?? alt ?? title)) ?? '');
        if (label) out.push(`*${film ? 'Film' : 'Photograph'}: ${label}*\n`);
        break;
      }
      case 'hr':
        out.push('---\n');
        break;
    }
  }

  /* No recognised block at all means a body that predates the editor: a
     paragraph somebody typed into a box. It is still the content. */
  if (out.length === 0) {
    const line = text(html);
    return line ? `${line}\n` : '';
  }

  return out.join('\n');
}
