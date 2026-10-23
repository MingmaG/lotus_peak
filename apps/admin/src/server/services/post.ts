import 'server-only';

import type { Post } from '@prisma/client';

import { ApiError, notFound } from '@/lib/api/handler';
import { db } from '@/lib/db';
import { stripRichTextMedia } from '@/server/schema/rich-text';
import { publishing, seoColumns } from './catalogue';
import { changeSlug, problemsPublishingPost, resolvePublishing } from './publish';
import { freeSlug } from './resource';
import { readingMinutes, type PostInput, type PostPatch } from '@/server/validators/post';

/**
 * Writing a journal entry.
 *
 * Here rather than in the route because two doors lead to it — the panel's
 * editor and an AI client over MCP — and a rule written into one of them is a
 * rule the other one does not have.
 */

export async function createPost(body: PostInput, authorId: string): Promise<Post> {
  return db.post.create({
    data: {
      slug: await freeSlug('post', body.slug || body.title),
      title: body.title,
      standfirst: body.standfirst,
      category: body.category,
      /* The URL inside each figure is derived from its media id and is put
         back on the way out, so it is taken out on the way in — a URL in the
         column is the thing that goes stale when the store moves. */
      body: stripRichTextMedia(body.body),
      readingMinutes: readingMinutes(body.body, body.standfirst),
      heroId: body.heroId ?? null,
      /* Whoever wrote it, unless somebody else is named. */
      authorId: body.authorId ?? authorId,
      tags: body.tags,
      featured: body.featured,
      sortOrder: body.sortOrder ?? (await db.post.count()),
      ...publishing({ next: body.status, currentStatus: 'DRAFT', currentPublishedAt: null }),
      ...seoColumns(body.seo),
      tripLinks: {
        create: body.relatedTripIds.map((tripId, index) => ({ tripId, sortOrder: index })),
      },
      destinations: {
        create: body.destinationIds.map((destinationId, index) => ({ destinationId, sortOrder: index })),
      },
      culture: {
        create: body.cultureIds.map((cultureId, index) => ({ cultureId, sortOrder: index })),
      },
    },
  });
}

export async function updatePost(
  id: string,
  body: PostPatch,
  /** Whether the person saving holds `journal.publish`. */
  options: { canPublish: boolean },
): Promise<{ before: Post; post: Post }> {
  const before = await db.post.findUnique({ where: { id } });
  if (!before) throw notFound('That entry');

  if (body.status === 'PUBLISHED' && before.status !== 'PUBLISHED' && !options.canPublish) {
    throw new ApiError(403, 'FORBIDDEN', 'This account can write entries but not publish them.');
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
    where: { id },
    data: {
      slug,
      slugHistory,
      title: body.title,
      standfirst: body.standfirst,
      category: body.category,
      /* `!== undefined`, not truthiness: an entry whose body has been
         emptied on purpose sends `''`, and a falsy check would quietly
         decline to save the deletion. */
      ...(body.body !== undefined
        ? {
            body: stripRichTextMedia(body.body),
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
      ...(body.destinationIds
        ? {
            destinations: {
              deleteMany: {},
              create: body.destinationIds.map((destinationId, index) => ({
                destinationId,
                sortOrder: index,
              })),
            },
          }
        : {}),
      ...(body.cultureIds
        ? {
            culture: {
              deleteMany: {},
              create: body.cultureIds.map((cultureId, index) => ({ cultureId, sortOrder: index })),
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

  return { before, post };
}

export async function softDeletePost(id: string): Promise<Post> {
  const post = await db.post.findUnique({ where: { id } });
  if (!post) throw notFound('That entry');
  await db.post.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });
  return post;
}
