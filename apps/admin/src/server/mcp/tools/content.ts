import 'server-only';

import type { McpRisk, Prisma } from '@prisma/client';
import { z } from 'zod';

import { can, type Permission } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { storedPageSectionSchema } from '@/server/schema/blocks';
import { richTextSchema } from '@/server/schema/rich-text';
import { destinationPath } from '@/server/services/content-paths';
import { updateDestination } from '@/server/services/destination-save';
import { updatePage } from '@/server/services/page';
import { createPost, softDeletePost, updatePost } from '@/server/services/post';
import { problemsPublishingPost } from '@/server/services/publish';
import type { DestinationInput } from '@/server/validators/catalogue';
import type { PagePatch } from '@/server/validators/page';
import { postSchema, type PostPatch } from '@/server/validators/post';
import { seoSchema } from '@/server/validators/trip';

import type { Actor } from '../context';
import { McpToolError } from '../errors';
import {
  assertUnchanged,
  changesFrom,
  defineRead,
  defineWrite,
  liveRecordEscalation,
  nothingToChange,
  stamp,
  type ToolDefinition,
} from '../operation';
import {
  assertMediaExists,
  limitSchema,
  mediaSummary,
  pushToSite,
  recordAiActivity,
  searchSchema,
  seoSummary,
  statusFilter,
} from './shared';

/**
 * The journal, the editorial pages and the places — the rest of the site's
 * words.
 *
 * Each kind has the same four doors: list, read, edit, and SEO. Editing a
 * draft happens at once; editing something published waits, because it is a
 * page the public is reading. SEO never waits: it changes no visible word.
 * Publishing is its own tool and always waits.
 *
 * Every write goes through the service the panel's own Save calls — the slug
 * redirects, the publish checks, the stripped figure URLs are the same code.
 */

/* -------------------------------------------------------------------------- */
/*  How each kind is loaded, saved and named                                   */
/* -------------------------------------------------------------------------- */

interface Kind<Row extends { id: string; status: string; updatedAt: Date }> {
  entity: 'post' | 'page' | 'destination';
  noun: string;
  idField: string;
  permissions: { read: Permission; write: Permission; publish: Permission };
  load(id: string): Promise<Row>;
  label(row: Row): string;
  path(row: Row): Promise<string> | string;
  save(id: string, patch: Record<string, unknown>, actor: Actor): Promise<{ row: Row; paths: string[] }>;
}

type PostRow = NonNullable<Awaited<ReturnType<typeof findPost>>>;
type PageRow = NonNullable<Awaited<ReturnType<typeof findPage>>>;
type PlaceRow = NonNullable<Awaited<ReturnType<typeof findPlace>>>;

function findPost(id: string) {
  return db.post.findFirst({
    where: { id, deletedAt: null },
    include: {
      hero: true,
      author: { select: { name: true } },
      tripLinks: { orderBy: { sortOrder: 'asc' }, include: { trip: { select: { id: true, title: true } } } },
    },
  });
}

function findPage(id: string) {
  return db.page.findFirst({ where: { id, deletedAt: null }, include: { hero: true } });
}

function findPlace(id: string) {
  return db.destination.findFirst({
    where: { id, deletedAt: null },
    include: { image: true, parent: { select: { slug: true, name: true } } },
  });
}

const POST: Kind<PostRow> = {
  entity: 'post',
  noun: 'journal entry',
  idField: 'postId',
  permissions: { read: 'journal.read', write: 'journal.write', publish: 'journal.publish' },
  async load(id) {
    const row = await findPost(id);
    if (!row) throw McpToolError.notFound('That journal entry', id);
    return row;
  },
  label: (row) => row.title,
  path: (row) => `/journal/${row.slug}`,
  async save(id, patch, actor) {
    const { before, post } = await updatePost(id, patch as PostPatch, {
      canPublish: can(actor.permissions, 'journal.publish'),
    });
    const row = await POST.load(post.id);
    const paths = [`/journal/${post.slug}`];
    if (before.slug !== post.slug) paths.push(`/journal/${before.slug}`);
    return { row, paths };
  },
};

const PAGE: Kind<PageRow> = {
  entity: 'page',
  noun: 'page',
  idField: 'pageId',
  permissions: { read: 'pages.read', write: 'pages.write', publish: 'pages.publish' },
  async load(id) {
    const row = await findPage(id);
    if (!row) throw McpToolError.notFound('That page', id);
    return row;
  },
  label: (row) => row.title,
  path: (row) => row.path,
  async save(id, patch) {
    const { before, page } = await updatePage(id, patch as PagePatch);
    const row = await PAGE.load(page.id);
    return { row, paths: [...new Set([page.path, before.path])] };
  },
};

const PLACE: Kind<PlaceRow> = {
  entity: 'destination',
  noun: 'place',
  idField: 'placeId',
  permissions: {
    read: 'destinations.read',
    write: 'destinations.write',
    publish: 'destinations.publish',
  },
  async load(id) {
    const row = await findPlace(id);
    if (!row) throw McpToolError.notFound('That place', id);
    return row;
  },
  label: (row) => row.name,
  path: (row) => destinationPath(row.slug, row.parent?.slug),
  async save(id, patch) {
    const { row, paths } = await updateDestination(id, patch as Partial<DestinationInput>);
    return { row: await PLACE.load(row.id), paths };
  },
};

/* -------------------------------------------------------------------------- */
/*  The factories                                                              */
/* -------------------------------------------------------------------------- */

/**
 * An edit to one record of a kind.
 *
 * `toPatch` maps the tool's arguments onto what the service takes; anything
 * the model sends that is not on the schema has already been refused by
 * `.strict()`.
 */
function editTool<Row extends { id: string; status: string; updatedAt: Date }>(def: {
  kind: Kind<Row>;
  name: string;
  title: string;
  description: string;
  section: string;
  risk: McpRisk;
  escalateWhenLive: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any>;
  toPatch(input: Record<string, unknown>): Record<string, unknown>;
  /** The record's current values, keyed like `compare`, for the card. */
  current(row: Row): Record<string, unknown>;
  /** What to compare against `current`, when it is not the patch itself. */
  compare?(input: Record<string, unknown>): Record<string, unknown>;
  mediaIds?(input: Record<string, unknown>): (string | null | undefined)[];
}): ToolDefinition {
  const { kind } = def;
  const idOf = (input: Record<string, unknown>) => input[kind.idField] as string;

  return defineWrite({
    name: def.name,
    title: def.title,
    description: def.description,
    permission: kind.permissions.write,
    entityType: kind.entity,
    schema: def.schema,
    risk: def.risk,
    requiresApproval: false,
    async prepare(input) {
      const row = await kind.load(idOf(input));
      await assertMediaExists(def.mediaIds?.(input) ?? []);
      const changes = changesFrom(def.current(row), (def.compare ?? def.toPatch)(input));
      if (Object.keys(changes).length === 0) nothingToChange();
      return {
        entityType: kind.entity,
        entityId: row.id,
        entityLabel: kind.label(row),
        summary: `Change the ${def.section} of the ${kind.noun} “${kind.label(row)}”`,
        proposedChanges: changes,
        preconditions: { updatedAt: stamp(row.updatedAt) },
        escalation: def.escalateWhenLive ? liveRecordEscalation(row, kind.noun) : null,
      };
    },
    async execute(input, prepared, actor) {
      const before = await kind.load(idOf(input));
      assertUnchanged(prepared.preconditions, { updatedAt: stamp(before.updatedAt) });
      const { row, paths } = await kind.save(before.id, def.toPatch(input), actor);
      recordAiActivity(actor, {
        action: 'UPDATE',
        entity: kind.entity,
        entityId: row.id,
        entityLabel: kind.label(row),
        before: Object.fromEntries(Object.entries(prepared.proposedChanges).map(([k, v]) => [k, v.from])) as never,
        after: Object.fromEntries(Object.entries(prepared.proposedChanges).map(([k, v]) => [k, v.to])) as never,
      });
      pushToSite(kind.entity, paths);
      return {
        entityId: row.id,
        entityLabel: kind.label(row),
        data: {
          id: row.id,
          path: await kind.path(row),
          status: row.status,
          version: stamp(row.updatedAt),
          changed: Object.keys(prepared.proposedChanges),
        },
      };
    },
  });
}

function seoTool<Row extends { id: string; status: string; updatedAt: Date } & Parameters<typeof seoSummary>[0]>(
  kind: Kind<Row>,
  name: string,
): ToolDefinition {
  return editTool({
    kind,
    name,
    title: `Edit a ${kind.noun}’s SEO`,
    section: 'SEO',
    description:
      `Edits how a ${kind.noun} appears in search and when shared: meta title and ` +
      'description, canonical URL, noindex, Open Graph title, description and image, ' +
      'keywords. Happens at once even when it is published — no visible word on the page ' +
      'changes. Send only what changes.',
    risk: 'LOW',
    escalateWhenLive: false,
    schema: z
      .object({ [kind.idField]: z.string().min(1), seo: seoSchema.omit({ schemaJson: true }).strict() })
      .strict(),
    toPatch: (input) => ({ seo: input.seo }),
    compare: (input) => input.seo as Record<string, unknown>,
    current: (row) => ({ ...row }),
    mediaIds: (input) => [(input.seo as { ogImageId?: string | null }).ogImageId],
  });
}

/** Publish or unpublish. Always waits for a person. */
function statusTool<Row extends { id: string; status: string; updatedAt: Date }>(def: {
  kind: Kind<Row>;
  name: string;
  to: 'PUBLISHED' | 'DRAFT';
  readiness?(id: string): Promise<{ field: string; message: string }[]>;
}): ToolDefinition {
  const { kind } = def;
  const publish = def.to === 'PUBLISHED';
  const verb = publish ? 'Publish' : 'Unpublish';

  async function ready(row: Row) {
    const problems = (await def.readiness?.(row.id)) ?? [];
    if (problems.length > 0) {
      throw new McpToolError('NOT_READY', `“${kind.label(row)}” is not ready to be published.`, { problems });
    }
  }

  return defineWrite({
    name: def.name,
    title: `${verb} a ${kind.noun}`,
    description: publish
      ? `Puts a ${kind.noun} on the website. Always waits for an administrator to approve it.`
      : `Takes a ${kind.noun} off the website, back to draft. Always waits for an administrator.`,
    permission: kind.permissions.publish,
    entityType: kind.entity,
    risk: 'HIGH',
    requiresApproval: true,
    schema: z.object({ [kind.idField]: z.string().min(1) }).strict(),
    async prepare(input) {
      const row = await kind.load(input[kind.idField] as string);
      if (publish ? row.status === 'PUBLISHED' : row.status !== 'PUBLISHED' && row.status !== 'SCHEDULED') {
        throw new McpToolError('CONFLICT', `“${kind.label(row)}” is ${row.status.toLowerCase()} already.`);
      }
      if (publish) await ready(row);
      /* Home and Contact are routes the website has components for. Taking
         one down leaves the route rendering nothing, which is what the
         panel's own delete refuses for the same reason. */
      if (!publish && (row as { isSystem?: boolean }).isSystem) {
        throw new McpToolError(
          'CONFLICT',
          `“${kind.label(row)}” is one of the site’s fixed pages and cannot be taken down. Its words can be changed.`,
        );
      }
      return {
        entityType: kind.entity,
        entityId: row.id,
        entityLabel: kind.label(row),
        summary: `${verb} the ${kind.noun} “${kind.label(row)}”`,
        proposedChanges: { status: { from: row.status, to: def.to } },
        preconditions: { updatedAt: stamp(row.updatedAt), status: row.status },
      };
    },
    async execute(input, prepared, actor) {
      const before = await kind.load(input[kind.idField] as string);
      assertUnchanged(prepared.preconditions, { updatedAt: stamp(before.updatedAt), status: before.status });
      if (publish) await ready(before);
      const { row, paths } = await kind.save(before.id, { status: def.to }, actor);
      recordAiActivity(actor, {
        action: publish ? 'PUBLISH' : 'UNPUBLISH',
        entity: kind.entity,
        entityId: row.id,
        entityLabel: kind.label(row),
        before: { status: before.status },
        after: { status: row.status },
      });
      pushToSite(kind.entity, paths);
      return {
        entityId: row.id,
        entityLabel: kind.label(row),
        data: { id: row.id, path: await kind.path(row), status: row.status },
      };
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  The journal                                                                */
/* -------------------------------------------------------------------------- */

const postId = z.string().min(1).describe('The entry’s id, from journal_list.');
const CATEGORY = z.enum(['JOURNEYS', 'TRAVEL_GUIDES', 'EXPERIENCES', 'STORIES']);

const journalList = defineRead({
  name: 'journal_list',
  title: 'List journal entries',
  description:
    'Lists journal entries, newest first, drafts included, with status, category, reading ' +
    'time and whether each has a meta description.',
  permission: 'journal.read',
  entityType: 'post',
  schema: z.object({ search: searchSchema, status: statusFilter, limit: limitSchema }).strict(),
  async run(input) {
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { standfirst: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await db.post.findMany({
      where,
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'first' } }, { updatedAt: 'desc' }],
      take: input.limit,
      select: {
        id: true,
        slug: true,
        title: true,
        standfirst: true,
        category: true,
        status: true,
        readingMinutes: true,
        publishedAt: true,
        metaDescription: true,
      },
    });
    return {
      total: await db.post.count({ where }),
      entries: rows.map(({ metaDescription, ...row }) => ({
        ...row,
        path: `/journal/${row.slug}`,
        hasMetaDescription: Boolean(metaDescription),
      })),
    };
  },
});

const journalGet = defineRead({
  name: 'journal_get',
  title: 'Read a journal entry',
  description:
    'Reads one journal entry: title, standfirst, the body as stored HTML (keep the markup ' +
    'when you send it back), category, tags, the journeys it links to, SEO, and what stops ' +
    'it being published.',
  permission: 'journal.read',
  entityType: 'post',
  schema: z.object({ postId }).strict(),
  async run({ postId: id }) {
    const post = await POST.load(id);
    return {
      id: post.id,
      slug: post.slug,
      path: `/journal/${post.slug}`,
      status: post.status,
      version: stamp(post.updatedAt),
      publishedAt: stamp(post.publishedAt),
      title: post.title,
      standfirst: post.standfirst,
      category: post.category,
      tags: post.tags,
      author: post.author?.name ?? null,
      readingMinutes: post.readingMinutes,
      body: post.body,
      hero: mediaSummary(post.hero),
      journeys: post.tripLinks.map((link) => link.trip),
      featured: post.featured,
      seo: seoSummary(post),
      publishProblems: await problemsPublishingPost(post.id),
    };
  },
});

const journalCreate = defineWrite({
  name: 'journal_create',
  title: 'Start a journal entry',
  description:
    'Creates a journal entry as a draft, with you as its author unless the person names ' +
    'another. The body is HTML: paragraphs, headings, lists, links. Publishing is ' +
    'journal_publish.',
  permission: 'journal.write',
  entityType: 'post',
  risk: 'LOW',
  requiresApproval: false,
  schema: z
    .object({
      title: z.string().min(1).max(200),
      standfirst: z.string().max(600).optional(),
      category: CATEGORY.optional(),
      body: richTextSchema.optional(),
      heroId: z.string().nullable().optional(),
      tags: z.array(z.string().max(60)).max(20).optional(),
      relatedTripIds: z.array(z.string()).max(12).optional(),
    })
    .strict(),
  async prepare(input) {
    await assertMediaExists([input.heroId]);
    return {
      entityType: 'post',
      entityId: null,
      entityLabel: input.title,
      summary: `Start a draft journal entry called “${input.title}”`,
      proposedChanges: Object.fromEntries(Object.entries(input).map(([k, to]) => [k, { from: null, to }])),
      preconditions: {},
    };
  },
  async execute(input, _prepared, actor) {
    const post = await createPost(postSchema.parse({ ...input, status: 'DRAFT' }), actor.id);
    recordAiActivity(actor, { action: 'CREATE', entity: 'post', entityId: post.id, entityLabel: post.title });
    return {
      entityId: post.id,
      entityLabel: post.title,
      data: { id: post.id, slug: post.slug, status: post.status, version: stamp(post.updatedAt) },
    };
  },
});

const journalUpdate = editTool({
  kind: POST,
  name: 'journal_update',
  title: 'Edit a journal entry',
  section: 'words',
  description:
    'Edits a journal entry: title, slug, standfirst, body (HTML — keep the markup you read), ' +
    'category, tags, hero photograph, linked journeys. Send only what changes; a list you ' +
    'send replaces that list. On a draft it happens at once; on a published entry it waits ' +
    'for approval. Not SEO (journal_update_seo), not publishing (journal_publish).',
  risk: 'MEDIUM',
  escalateWhenLive: true,
  schema: z
    .object({
      postId,
      title: z.string().min(1).max(200).optional(),
      slug: z.string().min(1).max(140).optional(),
      standfirst: z.string().max(600).optional(),
      category: CATEGORY.optional(),
      body: richTextSchema.optional(),
      heroId: z.string().nullable().optional(),
      tags: z.array(z.string().max(60)).max(20).optional(),
      featured: z.boolean().optional(),
      relatedTripIds: z.array(z.string()).max(12).optional(),
    })
    .strict(),
  toPatch: ({ postId: _id, ...patch }) => patch,
  current: (row) => ({ ...row, relatedTripIds: row.tripLinks.map((link) => link.trip.id) }),
  mediaIds: (input) => [input.heroId as string | null | undefined],
});

const journalDelete = defineWrite({
  name: 'journal_delete',
  title: 'Delete a journal entry',
  description:
    'Deletes a journal entry — recoverably, but it leaves the website at once. Always waits ' +
    'for an administrator. Prefer journal_unpublish unless deleting was asked for.',
  permission: 'journal.delete',
  entityType: 'post',
  risk: 'HIGH',
  requiresApproval: true,
  schema: z.object({ postId }).strict(),
  async prepare({ postId: id }) {
    const post = await POST.load(id);
    return {
      entityType: 'post',
      entityId: post.id,
      entityLabel: post.title,
      summary: `Delete the journal entry “${post.title}”`,
      proposedChanges: { deleted: { from: false, to: true } },
      preconditions: { updatedAt: stamp(post.updatedAt) },
    };
  },
  async execute({ postId: id }, prepared, actor) {
    const post = await POST.load(id);
    assertUnchanged(prepared.preconditions, { updatedAt: stamp(post.updatedAt) });
    await softDeletePost(post.id);
    recordAiActivity(actor, { action: 'DELETE', entity: 'post', entityId: post.id, entityLabel: post.title });
    pushToSite('post', [`/journal/${post.slug}`]);
    return { entityId: post.id, entityLabel: post.title, data: { id: post.id, deleted: true } };
  },
});

/* -------------------------------------------------------------------------- */
/*  Pages                                                                      */
/* -------------------------------------------------------------------------- */

const pageId = z.string().min(1).describe('The page’s id, from pages_list.');

const pagesList = defineRead({
  name: 'pages_list',
  title: 'List the site’s pages',
  description:
    'Lists the editorial pages — About, Contact, the home page’s own copy and the rest — ' +
    'with their address and status. `isSystem` pages are fixed routes: their words can ' +
    'change, their address cannot.',
  permission: 'pages.read',
  entityType: 'page',
  schema: z.object({ limit: limitSchema }).strict(),
  async run({ limit }) {
    const rows = await db.page.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      take: limit,
      select: { id: true, path: true, title: true, status: true, isSystem: true, metaDescription: true },
    });
    return {
      pages: rows.map(({ metaDescription, ...row }) => ({
        ...row,
        hasMetaDescription: Boolean(metaDescription),
      })),
    };
  },
});

const pagesGet = defineRead({
  name: 'pages_get',
  title: 'Read a page',
  description:
    'Reads one page: its heading copy (eyebrow, lead, note), its `sections` — the typed ' +
    'bands the page is built from, each with a `kind` — and its SEO.',
  permission: 'pages.read',
  entityType: 'page',
  schema: z.object({ pageId }).strict(),
  async run({ pageId: id }) {
    const page = await PAGE.load(id);
    return {
      id: page.id,
      path: page.path,
      isSystem: page.isSystem,
      status: page.status,
      version: stamp(page.updatedAt),
      title: page.title,
      eyebrow: page.eyebrow,
      lead: page.lead,
      note: page.note,
      hero: mediaSummary(page.hero),
      sections: page.sections,
      seo: seoSummary(page),
    };
  },
});

const pagesUpdate = editTool({
  kind: PAGE,
  name: 'pages_update',
  title: 'Edit a page',
  section: 'words',
  description:
    'Edits a page: title, eyebrow, lead, note, hero photograph, its address (not on a fixed ' +
    'page) or its `sections`. `sections` replaces all of them, so send back every section ' +
    'from pages_get with your change made — each must keep its `kind` and shape. On a ' +
    'published page it waits for approval.',
  risk: 'MEDIUM',
  escalateWhenLive: true,
  schema: z
    .object({
      pageId,
      title: z.string().min(1).max(200).optional(),
      path: z.string().max(200).regex(/^\//, 'It has to start with a /.').optional(),
      eyebrow: z.string().max(80).nullable().optional(),
      lead: z.string().max(800).nullable().optional(),
      note: z.string().max(300).nullable().optional(),
      heroId: z.string().nullable().optional(),
      sections: z.array(storedPageSectionSchema).max(60).optional(),
    })
    .strict(),
  toPatch: ({ pageId: _id, ...patch }) => patch,
  current: (row) => ({ ...row }),
  mediaIds: (input) => [input.heroId as string | null | undefined],
});

/* -------------------------------------------------------------------------- */
/*  Places                                                                     */
/* -------------------------------------------------------------------------- */

const placeId = z.string().min(1).describe('The place’s id, from places_list.');

const placesList = defineRead({
  name: 'places_list',
  title: 'List the places',
  description:
    'Lists the places on “Where we go” — valleys, and the places inside each — with their ' +
    'address and status.',
  permission: 'destinations.read',
  entityType: 'destination',
  schema: z.object({ search: searchSchema, limit: limitSchema }).strict(),
  async run({ search, limit }) {
    const rows = await db.destination.findMany({
      where: {
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { sortOrder: 'asc' }],
      take: limit,
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        blurb: true,
        metaDescription: true,
        parent: { select: { name: true, slug: true } },
      },
    });
    return {
      places: rows.map(({ metaDescription, parent, ...row }) => ({
        ...row,
        valley: parent?.name ?? null,
        path: destinationPath(row.slug, parent?.slug),
        hasMetaDescription: Boolean(metaDescription),
      })),
    };
  },
});

const placesGet = defineRead({
  name: 'places_get',
  title: 'Read a place',
  description: 'Reads one place: its card line, standfirst, body (stored HTML), photograph, altitude and SEO.',
  permission: 'destinations.read',
  entityType: 'destination',
  schema: z.object({ placeId }).strict(),
  async run({ placeId: id }) {
    const place = await PLACE.load(id);
    return {
      id: place.id,
      path: destinationPath(place.slug, place.parent?.slug),
      valley: place.parent?.name ?? null,
      status: place.status,
      version: stamp(place.updatedAt),
      name: place.name,
      blurb: place.blurb,
      standfirst: place.standfirst,
      body: place.body,
      image: mediaSummary(place.image),
      altitudeMetres: place.altitudeMetres,
      seo: seoSummary(place),
    };
  },
});

const placesUpdate = editTool({
  kind: PLACE,
  name: 'places_update',
  title: 'Edit a place',
  section: 'words',
  description:
    'Edits a place: name, slug, card line (`blurb`), standfirst, body (HTML), photograph, ' +
    'altitude. Moving a place to another valley is not offered here — do it in the panel. ' +
    'On a published place it waits for approval; a renamed slug keeps its old address with ' +
    'a redirect.',
  risk: 'MEDIUM',
  escalateWhenLive: true,
  schema: z
    .object({
      placeId,
      name: z.string().min(1).max(120).optional(),
      slug: z.string().min(1).max(140).optional(),
      blurb: z.string().min(1).max(300).optional(),
      standfirst: z.string().max(600).optional(),
      body: richTextSchema.optional(),
      imageId: z.string().nullable().optional(),
      altitudeMetres: z.number().int().min(0).max(9_000).nullable().optional(),
    })
    .strict(),
  toPatch: ({ placeId: _id, ...patch }) => patch,
  current: (row) => ({ ...row }),
  mediaIds: (input) => [input.imageId as string | null | undefined],
});

export const CONTENT_TOOLS: ToolDefinition[] = [
  journalList,
  journalGet,
  journalCreate,
  journalUpdate,
  seoTool(POST, 'journal_update_seo'),
  statusTool({ kind: POST, name: 'journal_publish', to: 'PUBLISHED', readiness: problemsPublishingPost }),
  statusTool({ kind: POST, name: 'journal_unpublish', to: 'DRAFT' }),
  journalDelete,

  pagesList,
  pagesGet,
  pagesUpdate,
  seoTool(PAGE, 'pages_update_seo'),
  statusTool({ kind: PAGE, name: 'pages_publish', to: 'PUBLISHED' }),
  statusTool({ kind: PAGE, name: 'pages_unpublish', to: 'DRAFT' }),

  placesList,
  placesGet,
  placesUpdate,
  seoTool(PLACE, 'places_update_seo'),
];
