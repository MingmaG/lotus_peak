import { NextResponse, type NextRequest } from 'next/server';

import { currentUser } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { MediaError, upload } from '@/server/services/media';
import { serialiseMediaRow } from '@/server/services/media-serialise';
import { recordActivity } from '@/server/services/activity';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
/** Sharp needs real time on a 6000-pixel photograph. */
export const maxDuration = 60;

/**
 * Uploading a photograph.
 *
 * Its own handler rather than `route()` from `lib/api/handler`, because that
 * wrapper parses a JSON body and this one takes `multipart/form-data`. The
 * permission check and the audit line are done by hand here, and that is the
 * one place in this application where they are — worth knowing if either ever
 * looks wrong.
 */
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } },
      { status: 401 },
    );
  }
  if (!can(user.permissions, 'media.write')) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'This account cannot upload.' } },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'No file was sent.' } },
      { status: 400 },
    );
  }

  try {
    const media = await upload({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      bytes: Buffer.from(await file.arrayBuffer()),
      alt: String(form.get('alt') ?? ''),
      isDecorative: form.get('isDecorative') === 'true',
      caption: (form.get('caption') as string) || null,
      credit: (form.get('credit') as string) || null,
      folderId: (form.get('folderId') as string) || null,
      uploadedById: user.id,
      /* WebP now so the editor sees a thumbnail immediately; the rest is
         filled in by `npm run media:rebuild`. */
      formats: ['webp'],
    });

    void recordActivity({
      userId: user.id,
      action: 'UPLOAD',
      entity: 'media',
      entityId: media.id,
      entityLabel: media.filename,
    }).catch(() => undefined);

    const withRenditions = await db.media.findUnique({
      where: { id: media.id },
      include: { renditions: true },
    });

    return NextResponse.json({ media: serialiseMediaRow(withRenditions ?? media) });
  } catch (error) {
    if (error instanceof MediaError) {
      return NextResponse.json(
        { error: { code: 'UPLOAD_FAILED', message: error.message } },
        { status: 422 },
      );
    }
    console.error('[media] upload failed', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'That upload did not work.' } },
      { status: 500 },
    );
  }
}
