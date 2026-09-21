import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { changeSlug, problemsPublishingPost, resolvePublishing } from '@/server/services/publish';
import { seoColumns } from '@/server/services/catalogue';
import { revalidateFor } from '@/server/services/revalidate';
import { postPatchSchema, readingMinutes, type PostPatch } from '@/server/validators/post';
import { parsePostBody } from '@/server/schema/blocks';

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
    const before = await db.post.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That entry');

    if (body.status === 'PUBLISHED' && before.status !== 'PUBLISHED') {
      if (!user.permissions.includes('*') && !user.permissions.includes('journal.publish')) {
        throw new ApiError(403, 'FORBIDDEN', 'This account can write entries but not publish them.');
      }
    }

    let slug = before.slug;
    let slugHistory = before.slugHistory;
    if (body.slug && body.slug !== before.slug) {
      const moved = await changeSlug({
        entity: 'post',
        currentSlug: before.slug,
        nextSlug: body.slug,
        currentHistory: before.slugHistory,
        pathPrefix: '/journal',
      });
      slug = moved.slug;
      slugHistory = moved.slugHistory;
    }

    const publishFields =
      body.status !== undefined
        ? resolvePublishing({
            next: body.status,
            currentStatus: before.status,
            currentPublishedAt: before.publishedAt,
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
            explicitPublishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
          })
        : body.publishedAt
          ? {
              status: before.status,
              publishedAt: new Date(body.publishedAt),
              scheduledFor: before.scheduledFor,
            }
          : null;

    const post = await db.post.update({
      where: { id: params.id },
      data: {
        slug,
        slugHistory,
        title: body.title,
        standfirst: body.standfirst,
        region: body.region,
        ...(body.body
          ? {
              body: body.body as never,
              readingMinutes: readingMinutes(body.body, body.standfirst ?? before.standfirst),
            }
          : {}),
        heroId: body.heroId === undefined ? undefined : body.heroId,
        authorId: body.authorId === undefined ? undefined : body.authorId,
        tags: body.tags,
        featured: body.featured,
        sortOrder: body.sortOrder,
        ...(publishFields ?? {}),
        ...seoColumns(body.seo),
        ...(body.relatedTripIds
          ? {
              tripLinks: {
                deleteMany: {},
                create: body.relatedTripIds.map((tripId, index) => ({ tripId, sortOrder: index })),
              },
            }
          : {}),
      },
    });

    /**
     * Checked after the write, not before it.
     *
     * The body arrives in the same request as the status, so a check that ran
     * first would be checking the row as it was — and would refuse to publish
     * an entry whose standfirst is being written in this very save.
     */
    if (post.status === 'PUBLISHED' && before.status !== 'PUBLISHED') {
      const problems = await problemsPublishingPost(post.id);
      if (problems.length > 0) {
        await db.post.update({
          where: { id: post.id },
          data: { status: before.status, publishedAt: before.publishedAt },
        });
        throw new ApiError(
          422,
          'NOT_READY',
          'This entry is not ready to be published.',
          Object.fromEntries(problems.map((problem) => [problem.field, problem.message])),
        );
      }
    }

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
    const post = await db.post.findUnique({ where: { id: params.id } });
    if (!post) throw notFound('That entry');

    await db.post.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    audit({ action: 'DELETE', entity: 'post', entityId: post.id, entityLabel: post.title });
    void revalidateFor('post', [`/journal/${post.slug}`]);
    return null;
  },
});

export { parsePostBody };
