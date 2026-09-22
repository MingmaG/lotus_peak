import 'server-only';

import type { Media, MediaRendition } from '@prisma/client';

import { storage } from '@/lib/storage';

/**
 * A media row as the **admin panel's own screens** need it.
 *
 * Deliberately not `serialiseMedia` from `media.ts`, which produces the
 * website's `ApiImage`: that one refuses a row with no dimensions and points
 * at the largest rendition, both of which are right for a published page and
 * wrong for a library. The library has to show the row that could not be
 * measured — it is the one somebody needs to fix — and it shows a thumbnail,
 * not a 1600 px hero.
 */
export interface AdminMedia {
  id: string;
  url: string;
  thumbnailUrl: string;
  alt: string;
  isDecorative: boolean;
  caption: string | null;
  credit: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  focalX: number;
  focalY: number;
  folderId: string | null;
  createdAt: string;
  renditionCount: number;
}

type Row = Media & { renditions?: MediaRendition[] };

export function serialiseMediaRow(media: Row): AdminMedia {
  const webp = (media.renditions ?? []).filter((r) => r.format === 'webp');
  const largest = [...webp].sort((a, b) => b.width - a.width)[0];
  /* 400 px where it exists — a grid of sixty thumbnails should not be sixty
     1600 px files, which is what the library did before this line. */
  const thumb = [...webp].sort((a, b) => a.width - b.width)[0];

  return {
    id: media.id,
    url: storage.publicUrl(largest?.storageKey ?? media.storageKey),
    thumbnailUrl: storage.publicUrl(thumb?.storageKey ?? media.storageKey),
    alt: media.alt,
    isDecorative: media.isDecorative,
    caption: media.caption,
    credit: media.credit,
    filename: media.filename,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    width: media.width,
    height: media.height,
    focalX: media.focalX,
    focalY: media.focalY,
    folderId: media.folderId,
    createdAt: media.createdAt.toISOString(),
    renditionCount: media.renditions?.length ?? 0,
  };
}
