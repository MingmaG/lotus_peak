import { db } from '@/lib/db';

import type { ImageMap } from './media';
import posts from '../seed-data/posts.json';

/**
 * The journal.
 *
 * `posts.json` holds the five entries as they were written on lotuspeak.org —
 * typed blocks, exported from the website's own fixture. The column holds one
 * rich-text document, so the conversion happens here.
 *
 * It is not shared with the website's copy of the same conversion
 * (`src/content/data/post-body.ts`) and that is deliberate: this one resolves
 * a photograph to a row in the media library, and that one has no library to
 * resolve to. What the two agree on is the output — the same handful of
 * elements, so the file provider stays the fixture the API provider is checked
 * against.
 *
 * The element each block becomes matches what the migration
 * `20260921160000_journal_body_is_rich_text` produced for a database that
 * already had entries in it. A seeded database and a migrated one hold the
 * same HTML for the same writing, which is the property that makes the
 * prerendered-HTML diff in `docs/CUTOVER.md` mean anything.
 *
 * A block whose photograph is not in the library is **dropped**, with a line
 * in the log — a `<figure>` with no id and no URL is a gap in the page that
 * nothing downstream can do anything about.
 */

interface PostJson {
  slug: string;
  title: string;
  standfirst: string;
  date: string;
  region: string;
  heroImage: string;
  order: number;
  body: (
    | { kind: 'text'; body: string }
    | { kind: 'heading'; text: string }
    | { kind: 'list'; items: string[] }
    | { kind: 'quote'; text: string }
    | { kind: 'image'; src: string; ratio?: string }
    | { kind: 'facts'; title: string; rows: [string, string][] }
  )[];
}

function escapeHtml(text: string): string {
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
function asParagraphs(value: string): string {
  if (HAS_TAG.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export async function seedJournal(images: ImageMap, authorId: string | null): Promise<void> {
  let droppedImages = 0;

  for (const post of posts as PostJson[]) {
    const parts: string[] = [];

    for (const block of post.body) {
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
                  ([label, value]) =>
                    `<tr><th><p>${escapeHtml(label)}</p></th>` +
                    `<td><p>${escapeHtml(value)}</p></td></tr>`,
                )
                .join('') +
              `</tbody></table>`,
          );
          break;

        case 'image': {
          const mediaId = images.get(block.src);
          if (!mediaId) {
            console.warn(`    ${post.slug}: dropped a photograph, ${block.src} is not in the library`);
            droppedImages += 1;
            break;
          }
          /**
           * The id is stored, and nothing else.
           *
           * No `src` and no `alt`: both are filled in from the media row on
           * every read (`server/schema/rich-text.ts`), which is what lets a
           * photograph be re-cropped or re-described without rewriting every
           * entry that used it. A URL written into the column here would be
           * the one copy that stops tracking the library.
           */
          const ratio = block.ratio ? ` data-ratio="${escapeHtml(block.ratio)}"` : '';
          parts.push(`<figure data-media-id="${mediaId}"${ratio}></figure>`);
          break;
        }
      }
    }

    const body = parts.join('\n');

    const base = {
      title: post.title,
      standfirst: post.standfirst,
      region: post.region,
      body,
      readingMinutes: readingMinutes(body, post.standfirst),
      heroId: images.get(post.heroImage) ?? null,
      authorId,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(post.date),
      sortOrder: post.order,
      metaDescription: post.standfirst,
    };

    await db.post.upsert({
      where: { slug: post.slug },
      create: { slug: post.slug, ...base },
      update: base,
    });
  }

  console.log(
    `  journal      ${posts.length}${droppedImages ? ` (${droppedImages} photograph(s) dropped)` : ''}`,
  );
}

/**
 * Minutes, at 200 words a minute.
 *
 * The panel's own `readingMinutes` is not imported here: it lives beside a Zod
 * schema in `server/validators`, and a seed that pulls in the validator layer
 * pulls in the request layer behind it. Same arithmetic, same 200 words a
 * minute, and the number is recomputed on the first save either way.
 */
function readingMinutes(body: string, standfirst: string): number {
  const words = `${standfirst} ${body.replace(/<[^>]+>/g, ' ')}`
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
