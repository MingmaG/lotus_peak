import { db } from '@/lib/db';
import { storedPostBodySchema, type StoredPostBlock } from '@/server/schema/blocks';

import type { ImageMap } from './media';
import posts from '../seed-data/posts.json';

/**
 * The journal.
 *
 * The one place the move genuinely changes the data. The website's `PostBlock`
 * union carries an image as `{ kind: 'image', src: '/assets/…' }` — a path,
 * because a TypeScript module had nothing else to hold. In the database it is
 * a media id, so the photograph inside a journal entry is the same row as the
 * photograph anywhere else: it has alt text, it has renditions, and replacing
 * the file behind it updates the entry without anybody editing the entry.
 *
 * A block whose photograph is not in the library is **dropped**, with a line
 * in the log. Keeping it would put `{ kind: 'image', image: null }` into the
 * body, and every renderer downstream would then have to handle an image block
 * with no image — a nullable field introduced by an import that ran once.
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

export async function seedJournal(images: ImageMap, authorId: string | null): Promise<void> {
  let droppedImages = 0;

  for (const post of posts as PostJson[]) {
    const body: StoredPostBlock[] = [];

    for (const block of post.body) {
      switch (block.kind) {
        case 'text':
          body.push({ kind: 'text', body: block.body });
          break;
        case 'heading':
          body.push({ kind: 'heading', text: block.text });
          break;
        case 'list':
          /* `ordered` is new. Every existing list in the journal is a bulleted
             one, and the editor offers the choice from here on. */
          body.push({ kind: 'list', items: block.items, ordered: false });
          break;
        case 'quote':
          /* Likewise `attribution`: the design's quote block never carried
             one, and the component renders the quote alone when it is null. */
          body.push({ kind: 'quote', text: block.text, attribution: null });
          break;
        case 'facts':
          body.push({ kind: 'facts', title: block.title, rows: block.rows });
          break;
        case 'image': {
          const mediaId = images.get(block.src);
          if (!mediaId) {
            console.warn(`    ${post.slug}: dropped an image block, ${block.src} is not in the library`);
            droppedImages += 1;
            break;
          }
          /**
           * The id is stored, not the serialised image.
           *
           * `ApiPostBlock` carries a whole `ApiImage` because that is what the
           * website receives. What the *column* holds is `{ mediaId }`, and
           * the public API resolves it on the way out — otherwise every alt
           * text correction would have to find and rewrite every journal body
           * that used the photograph.
           */
          body.push({ kind: 'image', mediaId, ratio: block.ratio ?? null });
          break;
        }
      }
    }

    const base = {
      title: post.title,
      standfirst: post.standfirst,
      region: post.region,
      /* Parsed on the way in, like every other write to this column — a seed
         that bypassed the schema would be the one path that can put a shape
         in the database the application cannot read back. */
      body: storedPostBodySchema.parse(body),
      readingMinutes: readingMinutes(post),
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
    `  journal      ${posts.length}${droppedImages ? ` (${droppedImages} image block(s) dropped)` : ''}`,
  );
}

/**
 * Minutes, at 200 words a minute.
 *
 * Computed here and stored so the admin panel and the website print the same
 * number. Two implementations of "how long is this to read" is two numbers
 * that differ by one on the entry somebody checks.
 */
function readingMinutes(post: PostJson): number {
  let words = post.standfirst.split(/\s+/).length;
  for (const block of post.body) {
    if (block.kind === 'text') words += block.body.split(/\s+/).length;
    if (block.kind === 'heading') words += block.text.split(/\s+/).length;
    if (block.kind === 'quote') words += block.text.split(/\s+/).length;
    if (block.kind === 'list') {
      words += block.items.reduce((sum, item) => sum + item.split(/\s+/).length, 0);
    }
  }
  return Math.max(1, Math.round(words / 200));
}
