import { notFound } from 'next/navigation';

import { MediaEditor } from '@/components/media/media-editor';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { countUses } from '@/server/services/media';
import { serialiseMediaRow } from '@/server/services/media-serialise';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await db.media.findUnique({ where: { id }, select: { filename: true } });
  return { title: media ? `${media.filename} · Media library` : 'Media library' };
}

export default async function MediaItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; needsAlt?: string }>;
}) {
  await requirePermission('media.read');
  const { id } = await params;
  const { q, needsAlt } = await searchParams;

  const [media, canWrite, canDelete] = await Promise.all([
    db.media.findUnique({ where: { id }, include: { renditions: true } }),
    hasPermission('media.write'),
    hasPermission('media.delete'),
  ]);
  if (!media) notFound();
  const uses = await countUses(media.id);

  /* The library's filters ride along on the tile's link and come back on
     Cancel and Save — only the two the library knows, so this is not an open
     redirect to wherever a crafted link says. */
  const back = new URLSearchParams();
  if (q) back.set('q', q);
  if (needsAlt === '1') back.set('needsAlt', '1');
  const backHref = back.size ? `/media?${back.toString()}` : '/media';

  return (
    <MediaEditor
      media={serialiseMediaRow(media)}
      uses={uses}
      backHref={backHref}
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
