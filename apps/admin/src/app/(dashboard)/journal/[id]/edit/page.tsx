import { notFound } from 'next/navigation';

import { PostEditor } from '@/components/content/post-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import {
  authorOptions,
  cultureOptions,
  linkOptions,
  placeOptions,
  siteUrl,
  tripOptions,
} from '@/server/services/content-editor';
import { postFormData } from '@/server/services/post-form';

export const metadata = { title: 'Edit entry' };
export const dynamic = 'force-dynamic';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('journal.write');
  const { id } = await params;

  const [post, authors, trips, options, url] = await Promise.all([
    postFormData(id),
    authorOptions(),
    tripOptions(),
    linkOptions(),
    siteUrl(),
  ]);
  if (!post) notFound();

  return (
    <PostEditor
      initial={post}
      authors={authors}
      trips={trips}
      places={placeOptions(options)}
      culture={cultureOptions(options)}
      siteUrl={url}
      canPublish={can(user.permissions, 'journal.publish')}
    />
  );
}
