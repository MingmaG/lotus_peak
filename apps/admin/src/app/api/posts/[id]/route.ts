import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { can } from '@/lib/auth/permissions';
import { diff } from '@/server/services/activity';
import { softDeletePost, updatePost } from '@/server/services/post';
import { revalidateFor } from '@/server/services/revalidate';
import { postPatchSchema, type PostPatch } from '@/server/validators/post';

export const GET = route<undefined, { id: string }>({
  permission: 'journal.read',
  handler: async ({ params }) => {
    const post = await db.post.findUnique({
      where: { id: params.id },
      include: {
        hero: { include: { renditions: { where: { format: 'webp' } } } },
        ogImage: { include: { renditions: { where: { format: 'webp' } } } },
        tripLinks: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!post) throw notFound('That entry');
    return { post };
  },
});

export const PATCH = route<PostPatch, { id: string }>({
  permission: 'journal.write',
  schema: postPatchSchema,
  handler: async ({ params, body, user, audit }) => {
    const { before, post } = await updatePost(params.id, body, {
      canPublish: can(user.permissions, 'journal.publish'),
    });

    const changes = diff(before as never, post as never);
    audit({
      action:
        body.status === 'PUBLISHED' && before.status !== 'PUBLISHED' ? 'PUBLISH' : 'UPDATE',
      entity: 'post',
      entityId: post.id,
      entityLabel: post.title,
      before: changes.before as never,
      after: changes.after as never,
    });

    const paths = [`/journal/${post.slug}`];
    if (before.slug !== post.slug) paths.push(`/journal/${before.slug}`);

    return { post, revalidated: await revalidateFor('post', paths) };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'journal.delete',
  handler: async ({ params, audit }) => {
    const post = await softDeletePost(params.id);

    audit({ action: 'DELETE', entity: 'post', entityId: post.id, entityLabel: post.title });
    void revalidateFor('post', [`/journal/${post.slug}`]);
    return null;
  },
});
