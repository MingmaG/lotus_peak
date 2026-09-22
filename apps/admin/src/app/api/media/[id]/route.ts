import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { MediaError, countUses, remove } from '@/server/services/media';
import { serialiseMediaRow } from '@/server/services/media-serialise';
import { diff } from '@/server/services/activity';
import { revalidateFor } from '@/server/services/revalidate';

const schema = z.object({
  alt: z.string().max(1_000).optional(),
  isDecorative: z.boolean().optional(),
  caption: z.string().max(400).nullable().optional(),
  credit: z.string().max(200).nullable().optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
  folderId: z.string().nullable().optional(),
});

export const GET = route<undefined, { id: string }>({
  permission: 'media.read',
  handler: async ({ params }) => {
    const media = await db.media.findUnique({
      where: { id: params.id },
      include: { renditions: true },
    });
    if (!media) throw notFound('That photograph');
    const uses = await countUses(media.id);
    return { media: serialiseMediaRow(media), uses };
  },
});

export const PATCH = route<z.infer<typeof schema>, { id: string }>({
  permission: 'media.write',
  schema,
  handler: async ({ params, body, audit }) => {
    const before = await db.media.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That photograph');

    /**
     * A description, or an explicit decision that it is decorative.
     *
     * The same rule the upload enforces, applied to an edit — because clearing
     * the description of an image already on a published page is exactly as
     * bad as uploading one without, and rather more likely.
     */
    const alt = body.alt ?? before.alt;
    const decorative = body.isDecorative ?? before.isDecorative;
    if (!decorative && alt.trim().length === 0) {
      throw new ApiError(
        422,
        'VALIDATION_FAILED',
        'Describe the photograph, or mark it decorative.',
        { alt: 'This cannot be left empty.' },
      );
    }

    const media = await db.media.update({
      where: { id: params.id },
      data: {
        alt: decorative ? '' : alt.trim(),
        isDecorative: decorative,
        caption: body.caption === undefined ? undefined : body.caption?.trim() || null,
        credit: body.credit === undefined ? undefined : body.credit?.trim() || null,
        focalX: body.focalX,
        focalY: body.focalY,
        folderId: body.folderId === undefined ? undefined : body.folderId,
      },
      include: { renditions: true },
    });

    const changes = diff(before as never, media as never);
    audit({
      action: 'UPDATE',
      entity: 'media',
      entityId: media.id,
      entityLabel: media.filename,
      before: changes.before as never,
      after: changes.after as never,
    });

    /* A description or a crop that changed is visible on every page using it. */
    void revalidateFor('media');

    return { media: serialiseMediaRow(media) };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'media.delete',
  handler: async ({ params, audit }) => {
    const media = await db.media.findUnique({ where: { id: params.id } });
    if (!media) throw notFound('That photograph');

    try {
      await remove(params.id);
    } catch (error) {
      if (error instanceof MediaError) {
        throw new ApiError(409, 'IN_USE', error.message);
      }
      throw error;
    }

    audit({
      action: 'DELETE',
      entity: 'media',
      entityId: params.id,
      entityLabel: media.filename,
    });

    return null;
  },
});
