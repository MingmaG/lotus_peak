import type { ImageMap } from './media';

/**
 * The typed blocks the old website's content was written in, as the one
 * rich-text document every body is stored as now.
 *
 * Shared by the journal and Where we go: the place pieces that used to be
 * journal entries — Taktsang, Punakha Dzong, Trongsa Dzong, and the Thimphu
 * and Bumthang pages — are destinations now, and they have to come out as the
 * same HTML they did as entries, because that is what the migration
 * `20260923090000_where_we_go_culture_and_journal` carried across for a
 * database that already had them. A seeded database and a migrated one hold
 * the same body for the same writing.
 *
 * A block whose photograph is not in the library is **dropped**, with a line
 * in the log — a `<figure>` with no id and no URL is a gap in the page that
 * nothing downstream can do anything about.
 */

export type Block =
  | { kind: 'text'; body: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'image'; src: string; ratio?: string }
  | { kind: 'facts'; title: string; rows: [string, string][] };

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HAS_TAG = /<[a-z][a-z0-9]*\b[^>]*>/i;

/**
 * A `text` or `quote` block, as paragraphs.
 *
 * These blocks were *allowed* to hold markup and mostly do not — the five
 * entries are prose typed into a box, one paragraph per block. Passed through
 * unwrapped that becomes a loose text node, and an entry of eleven of them
 * renders as one unbroken slab. A block that does hold markup is already
 * paragraphed and is left alone.
 */
export function asParagraphs(value: string): string {
  if (HAS_TAG.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Blocks → one body. Returns the HTML and how many photographs were dropped. */
export function blocksToHtml(
  blocks: Block[],
  images: ImageMap,
  label: string,
): { html: string; dropped: number } {
  const parts: string[] = [];
  let dropped = 0;

  for (const block of blocks) {
    switch (block.kind) {
      case 'text':
        parts.push(asParagraphs(block.body));
        break;

      case 'heading':
        parts.push(`<h2>${escapeHtml(block.text)}</h2>`);
        break;

      case 'quote':
        parts.push(`<blockquote>${asParagraphs(block.text)}</blockquote>`);
        break;

      case 'list':
        parts.push(
          `<ul>${block.items.map((item) => `<li><p>${escapeHtml(item)}</p></li>`).join('')}</ul>`,
        );
        break;

      case 'facts':
        /* An `<h4>` label and a two-column table: what the design drew the
           facts block as, and what a crawler or an assistant can lift a
           value out of. A paragraph of the same numbers is not. */
        parts.push(
          `<h4>${escapeHtml(block.title)}</h4><table><tbody>` +
            block.rows
              .map(
                ([rowLabel, value]) =>
                  `<tr><th><p>${escapeHtml(rowLabel)}</p></th>` +
                  `<td><p>${escapeHtml(value)}</p></td></tr>`,
              )
              .join('') +
            `</tbody></table>`,
        );
        break;

      case 'image': {
        const mediaId = images.get(block.src);
        if (!mediaId) {
          console.warn(`    ${label}: dropped a photograph, ${block.src} is not in the library`);
          dropped += 1;
          break;
        }
        /**
         * The id is stored, and nothing else.
         *
         * No `src` and no `alt`: both are filled in from the media row on
         * every read (`server/schema/rich-text.ts`), which is what lets a
         * photograph be re-cropped or re-described without rewriting every
         * body that used it.
         */
        const ratio = block.ratio ? ` data-ratio="${escapeHtml(block.ratio)}"` : '';
        parts.push(`<figure data-media-id="${mediaId}"${ratio}></figure>`);
        break;
      }
    }
  }

  return { html: parts.join('\n'), dropped };
}

/**
 * Minutes, at 200 words a minute.
 *
 * The panel's own `readingMinutes` is not imported here: it lives beside a Zod
 * schema in `server/validators`, and a seed that pulls in the validator layer
 * pulls in the request layer behind it. Same arithmetic, same 200 words a
 * minute, and the number is recomputed on the first save either way.
 */
export function readingMinutes(body: string, standfirst: string): number {
  const words = `${standfirst} ${body.replace(/<[^>]+>/g, ' ')}`
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
