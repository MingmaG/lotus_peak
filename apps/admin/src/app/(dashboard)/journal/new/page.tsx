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
import { emptyPostForm } from '@/server/services/post-form';

export const metadata = { title: 'New entry' };
export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  const user = await requirePermission('journal.write');

  const [authors, trips, options, url] = await Promise.all([
    authorOptions(),
    tripOptions(),
    linkOptions(),
    siteUrl(),
  ]);

  return (
    <PostEditor
      initial={emptyPostForm()}
      authors={authors}
      trips={trips}
      places={placeOptions(options)}
      culture={cultureOptions(options)}
      siteUrl={url}
      canPublish={can(user.permissions, 'journal.publish')}
    />
  );
}
