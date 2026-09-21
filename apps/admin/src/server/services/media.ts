import 'server-only';

import sharp from 'sharp';
import type { Media, MediaRendition } from '@prisma/client';
import type { ApiImage } from '@lotuspeak/api-contracts';
import {
  RENDITION_FORMATS,
  originalKey,
  renditionKey,
  widthsFor,
  type RenditionFormat,
} from '@lotuspeak/media';

import { db } from '@/lib/db';
import { storage } from '@/lib/storage';

/**
 * The media library.
 *
 * Uploading a photograph is three things that must either all happen or none:
 * the original is stored, its renditions are built and stored, and one row
 * describes all of it. They are ordered so that a failure leaves orphaned
 * *bytes* rather than a row pointing at nothing — an orphaned object costs
 * disk and is swept up; a row whose file is missing is a broken image on a
 * published page.
 */

/** What the office may upload. */
const ALLOWED_IMAGE = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const ALLOWED_DOCUMENT = new Set(['application/pdf']);

const MAX_BYTES = 25 * 1024 * 1024;

export class MediaError extends Error {}

export interface UploadInput {
  filename: string;
  contentType: string;
  bytes: Buffer;
  alt: string;
  isDecorative?: boolean;
  caption?: string | null;
  credit?: string | null;
  folderId?: string | null;
  uploadedById: string | null;
  /**
   * Which rendition formats to build now.
   *
   * Defaults to all three. The seed passes `['webp']` so a first run is a
   * minute rather than ten, and `npm run media:rebuild` fills in AVIF and
   * JPEG afterwards while somebody is already using the panel.
   */
  formats?: readonly RenditionFormat[];
}

export async function upload(input: UploadInput): Promise<Media> {
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new MediaError(
      `That file is ${(input.bytes.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB — resize it and try again.`,
    );
  }

  const isImage = ALLOWED_IMAGE.has(input.contentType);
  const isDocument = ALLOWED_DOCUMENT.has(input.contentType);
  if (!isImage && !isDocument) {
    throw new MediaError(
      `${input.contentType} is not something this library accepts. Images and PDFs only.`,
    );
  }

  /**
   * Alt text, or an explicit decision that it is decorative.
   *
   * Enforced here and not only in the form, because the upload endpoint is
   * also what a bulk import calls, and an import that skipped this would put
   * three hundred images into the library with no alt text at all.
   */
  if (!input.isDecorative && input.alt.trim().length === 0) {
    throw new MediaError(
      'Describe the photograph, or mark it decorative. An image with neither is invisible to anyone using a screen reader.',
    );
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const extension = extensionFor(input.filename, input.contentType);

  let width: number | null = null;
  let height: number | null = null;
  let blurDataUrl: string | null = null;
  let body = input.bytes;

  if (isImage) {
    const image = sharp(input.bytes, { failOn: 'none' });
    const meta = await image.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;

    if (!width || !height) {
      throw new MediaError(
        'That image could not be read. It may be corrupt, or an unusual variant of its format.',
      );
    }

    /**
     * Strip metadata, keeping the orientation.
     *
     * A photograph off a phone carries GPS coordinates. Publishing the
     * library's originals means publishing where every one of them was taken,
     * which for a company whose photographs are of monasteries and private
     * ceremonies is not a trade anybody agreed to. `rotate()` with no argument
     * bakes the EXIF orientation into the pixels first, so stripping it does
     * not turn every portrait sideways.
     */
    body = await image.rotate().toBuffer();

    blurDataUrl = await makeBlur(body);
  }

  const key = originalKey(id, extension);
  await storage.put(key, body, input.contentType);

  const media = await db.media.create({
    data: {
      id,
      kind: isImage ? 'IMAGE' : 'DOCUMENT',
      storageKey: key,
      filename: input.filename,
      mimeType: input.contentType,
      sizeBytes: body.byteLength,
      width,
      height,
      blurDataUrl,
      alt: input.isDecorative ? '' : input.alt.trim(),
      isDecorative: input.isDecorative ?? false,
      caption: input.caption?.trim() || null,
      credit: input.credit?.trim() || null,
      folderId: input.folderId ?? null,
      uploadedById: input.uploadedById,
    },
  });

  if (isImage && width) {
    await buildRenditions(media.id, body, width, input.formats);
  }

  return media;
}

/**
 * Builds every size this photograph is big enough for.
 *
 * Never upscales — `widthsFor` returns only widths at or below the source —
 * because a 1600 px rendition of a 900 px photograph is a bigger file carrying
 * no more detail, and `srcset` would dutifully choose it on a retina phone.
 *
 * AVIF is built alongside WebP and is roughly 30% smaller at the same quality,
 * but takes several times as long to encode; both are stored and the site
 * offers AVIF first with WebP behind it, so an old browser is not served a
 * format it cannot decode.
 */
export async function buildRenditions(
  mediaId: string,
  source: Buffer,
  sourceWidth: number,
  /**
   * Which formats to build.
   *
   * A parameter so the seed can skip AVIF. Encoding it is several times slower
   * than WebP, and a first run that builds 52 photographs at five widths in
   * three formats is a ten-minute wait before anybody can see the panel at
   * all. `npm run media:rebuild` fills the rest in afterwards.
   */
  formats: readonly RenditionFormat[] = RENDITION_FORMATS,
): Promise<MediaRendition[]> {
  const widths = widthsFor(sourceWidth);
  const out: MediaRendition[] = [];

  for (const width of widths) {
    for (const format of formats) {
      const pipeline = sharp(source, { failOn: 'none' }).resize({
        width,
        withoutEnlargement: true,
      });

      const encoded =
        format === 'avif'
          ? await pipeline.avif({ quality: 55 }).toBuffer({ resolveWithObject: true })
          : format === 'webp'
            ? await pipeline.webp({ quality: 78 }).toBuffer({ resolveWithObject: true })
            : await pipeline
                .jpeg({ quality: 82, mozjpeg: true })
                .toBuffer({ resolveWithObject: true });

      const key = renditionKey(mediaId, width, format);
      await storage.put(key, encoded.data, mimeFor(format));

      const row = await db.mediaRendition.upsert({
        where: { mediaId_width_format: { mediaId, width, format } },
        create: {
          mediaId,
          width,
          height: encoded.info.height,
          format,
          storageKey: key,
          sizeBytes: encoded.data.byteLength,
        },
        update: {
          height: encoded.info.height,
          storageKey: key,
          sizeBytes: encoded.data.byteLength,
        },
      });
      out.push(row);
    }
  }

  return out;
}

/**
 * A 16 px preview, inline.
 *
 * Small enough that the data URI is under a kilobyte and can sit in the HTML,
 * which is the point: a blur placeholder fetched over the network arrives
 * after the image it is standing in for.
 */
async function makeBlur(source: Buffer): Promise<string | null> {
  try {
    const buffer = await sharp(source, { failOn: 'none' })
      .resize(16, 16, { fit: 'inside' })
      .webp({ quality: 40 })
      .toBuffer();
    return `data:image/webp;base64,${buffer.toString('base64')}`;
  } catch {
    /* A placeholder is a nicety. An upload must not fail for want of one. */
    return null;
  }
}

function mimeFor(format: RenditionFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

function extensionFor(filename: string, contentType: string): string {
  const fromName = filename.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return contentType.split('/')[1] ?? 'bin';
}

/**
 * Replaces the file behind a photograph, keeping every reference to it.
 *
 * The office does this — a better crop of the same scene, a corrected colour —
 * and the alternative is uploading a second row and finding the fourteen
 * places that pointed at the first. The id does not change, so nothing has to.
 */
export async function replaceFile(
  mediaId: string,
  filename: string,
  contentType: string,
  bytes: Buffer,
): Promise<Media> {
  const existing = await db.media.findUnique({
    where: { id: mediaId },
    include: { renditions: true },
  });
  if (!existing) throw new MediaError('That photograph is no longer in the library.');

  if (!ALLOWED_IMAGE.has(contentType)) {
    throw new MediaError('The replacement has to be an image.');
  }

  const image = sharp(bytes, { failOn: 'none' });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) {
    throw new MediaError('That image could not be read.');
  }
  const body = await image.rotate().toBuffer();

  /* Old renditions first: a 2400 px original replaced by a 900 px one leaves
     rows for widths the new file cannot fill, and they would keep serving the
     old picture. */
  for (const rendition of existing.renditions) {
    await storage.delete(rendition.storageKey).catch(() => undefined);
  }
  await db.mediaRendition.deleteMany({ where: { mediaId } });

  const extension = extensionFor(filename, contentType);
  const key = originalKey(mediaId, extension);
  await storage.put(key, body, contentType);
  if (key !== existing.storageKey) {
    await storage.delete(existing.storageKey).catch(() => undefined);
  }

  const updated = await db.media.update({
    where: { id: mediaId },
    data: {
      storageKey: key,
      filename,
      mimeType: contentType,
      sizeBytes: body.byteLength,
      width: meta.width,
      height: meta.height,
      blurDataUrl: await makeBlur(body),
    },
  });

  await buildRenditions(mediaId, body, meta.width);
  return updated;
}

/**
 * Removes a photograph and everything built from it.
 *
 * Refuses when something still points at it. A cascade here would silently
 * blank a hero image on a published journey, and "why did the Jomolhari page
 * lose its photograph" is a much worse afternoon than "this is used in four
 * places, here they are".
 */
export async function remove(mediaId: string): Promise<void> {
  const uses = await countUses(mediaId);
  if (uses.total > 0) {
    throw new MediaError(
      `This photograph is used in ${uses.total} ${uses.total === 1 ? 'place' : 'places'}: ${uses.where.join(', ')}. Replace it there first.`,
    );
  }

  const renditions = await db.mediaRendition.findMany({ where: { mediaId } });
  const media = await db.media.findUnique({ where: { id: mediaId } });

  for (const rendition of renditions) {
    await storage.delete(rendition.storageKey).catch(() => undefined);
  }
  if (media) await storage.delete(media.storageKey).catch(() => undefined);

  await db.media.delete({ where: { id: mediaId } });
}

export async function countUses(
  mediaId: string,
): Promise<{ total: number; where: string[] }> {
  const [
    tripHero,
    tripOg,
    tripGallery,
    itinerary,
    destination,
    activity,
    season,
    culture,
    gallery,
    postHero,
    pageHero,
    person,
  ] = await Promise.all([
    db.trip.count({ where: { heroId: mediaId } }),
    db.trip.count({ where: { ogImageId: mediaId } }),
    db.tripGalleryItem.count({ where: { mediaId } }),
    db.itineraryImage.count({ where: { mediaId } }),
    db.destination.count({ where: { OR: [{ imageId: mediaId }, { ogImageId: mediaId }] } }),
    db.activity.count({ where: { OR: [{ imageId: mediaId }, { ogImageId: mediaId }] } }),
    db.season.count({ where: { imageId: mediaId } }),
    db.cultureArticle.count({ where: { OR: [{ imageId: mediaId }, { ogImageId: mediaId }] } }),
    db.galleryImage.count({ where: { mediaId } }),
    db.post.count({ where: { OR: [{ heroId: mediaId }, { ogImageId: mediaId }] } }),
    db.page.count({ where: { OR: [{ heroId: mediaId }, { ogImageId: mediaId }] } }),
    db.person.count({ where: { photoId: mediaId } }),
  ]);

  const named: [string, number][] = [
    ['journeys', tripHero + tripOg + tripGallery + itinerary],
    ['destinations', destination],
    ['activities', activity],
    ['seasons', season],
    ['culture', culture],
    ['the gallery', gallery],
    ['journal entries', postHero],
    ['pages', pageHero],
    ['people', person],
  ];

  const where = named.filter(([, count]) => count > 0).map(([label]) => label);
  const total = named.reduce((sum, [, count]) => sum + count, 0);
  return { total, where };
}

/* -------------------------------------------------------------------------- */
/*  Serialisation                                                              */
/* -------------------------------------------------------------------------- */

export type MediaWithRenditions = Media & { renditions?: MediaRendition[] };

/**
 * A media row as the website receives it.
 *
 * `width` and `height` are not optional in the contract, and a row without
 * them cannot be published — so this returns null rather than sending a shape
 * the website would have to guess at. The caller decides what a missing image
 * means on its page; nothing downstream has to handle half an image.
 */
export function serialiseMedia(
  media: MediaWithRenditions | null | undefined,
  adminOrigin: string,
): ApiImage | null {
  if (!media || !media.width || !media.height) return null;

  /**
   * The URL is the largest WebP rendition, not the original.
   *
   * The original may be a 6 MB JPEG straight off a camera. Handing the website
   * that and relying on `next/image` to resize it means the admin panel does
   * the work once at upload and the site does it again on every cold render.
   */
  const best = (media.renditions ?? [])
    .filter((rendition) => rendition.format === 'webp')
    .sort((a, b) => b.width - a.width)[0];

  const key = best?.storageKey ?? media.storageKey;
  const url = key.startsWith('http')
    ? key
    : absoluteFor(key, adminOrigin);

  return {
    id: media.id,
    url,
    alt: media.alt,
    width: best?.width ?? media.width,
    height: best?.height ?? media.height,
    blurDataUrl: media.blurDataUrl,
    focal: [media.focalX, media.focalY],
    decorative: media.isDecorative,
    caption: media.caption,
    credit: media.credit,
  };
}

function absoluteFor(key: string, adminOrigin: string): string {
  const url = storage.publicUrl(key);
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${adminOrigin.replace(/\/$/, '')}${url}`;
}

/** What `include` every serialiser needs. Written once so none of them forgets. */
export const MEDIA_INCLUDE = {
  renditions: { where: { format: 'webp' }, orderBy: { width: 'desc' } },
} as const;
