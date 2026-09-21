import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { db } from '@/lib/db';
import { upload } from '@/server/services/media';

import images from '../seed-data/images.json';

/**
 * Moves the website's photographs into the media library.
 *
 * The files are in `apps/web/public/assets/`, where the design put them, and
 * their alt text and dimensions are in `images.json` — exported from
 * `src/lib/assets.ts`, where somebody had already looked at each photograph
 * and written a description of it. That is the part worth carrying across: 52
 * pieces of real alt text are a day's work nobody should repeat, and an import
 * that dropped them would put 52 undescribed images into the library.
 *
 * ## The map this returns
 *
 * `/assets/imagery/taktshang.webp` → the new media id. Every other seed module
 * needs it, because the content refers to photographs by the path the design
 * used and the database refers to them by id.
 */

export type ImageMap = Map<string, string>;

const WEB_PUBLIC = path.resolve(process.cwd(), '../web/public');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export async function seedMedia(uploadedById: string | null): Promise<ImageMap> {
  const map: ImageMap = new Map();

  /**
   * Folders, so the library is not one wall of 52 thumbnails.
   *
   * Derived from the path the design used — `imagery`, `illustrations`,
   * `textures` — because that grouping is already the one the photographs
   * were organised by, and inventing a different one here would mean the
   * office learning a second scheme for the same pictures.
   */
  const folders = new Map<string, string>();
  for (const name of ['imagery', 'illustrations', 'textures']) {
    /**
     * `findFirst` then `create`, not `upsert`.
     *
     * The composite unique is `(parentId, slug)` and `parentId` is null on a
     * root folder — and Postgres does not consider NULL equal to NULL, so the
     * unique never matches and `upsert` would create a second "Imagery" on
     * every re-seed.
     */
    const existing = await db.mediaFolder.findFirst({
      where: { parentId: null, slug: name },
    });
    const folder =
      existing ?? (await db.mediaFolder.create({ data: { name: label(name), slug: name } }));
    folders.set(name, folder.id);
  }

  const entries = Object.entries(images as Record<string, { alt: string; width: number; height: number }>);
  let created = 0;
  let reused = 0;
  let missing = 0;

  for (const [src, record] of entries) {
    const filename = src.split('/').pop() ?? 'image';
    const group = src.split('/')[2] ?? 'imagery';

    /**
     * Idempotent on the filename.
     *
     * Re-running the seed must not upload 52 duplicates, and the filename is
     * the only thing that survives the move — the id is generated here and the
     * storage key is derived from it.
     */
    const existing = await db.media.findFirst({ where: { filename } });
    if (existing) {
      map.set(src, existing.id);
      reused += 1;
      continue;
    }

    const file = path.join(WEB_PUBLIC, src.replace(/^\/+/, ''));
    let bytes: Buffer;
    try {
      bytes = await readFile(file);
    } catch {
      /* A path the content names and the repository does not have. Reported
         rather than thrown: one absent photograph should not stop a seed that
         is otherwise loading the whole site. */
      console.warn(`    missing file: ${src}`);
      missing += 1;
      continue;
    }

    const extension = path.extname(filename).toLowerCase();

    const media = await upload({
      filename,
      contentType: MIME[extension] ?? 'image/jpeg',
      bytes,
      alt: record.alt,
      folderId: folders.get(group) ?? null,
      uploadedById,
      formats: ['webp'],
    });

    map.set(src, media.id);
    created += 1;
  }

  console.log(
    `  media        ${created} uploaded, ${reused} already there${missing ? `, ${missing} missing` : ''}`,
  );
  return map;
}

function label(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
