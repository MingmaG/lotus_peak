import 'server-only';

import type { McpRisk, Prisma } from '@prisma/client';
import { z } from 'zod';

import type { Permission } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { richTextSchema } from '@/server/schema/rich-text';
import { problemsPublishingTrip } from '@/server/services/publish';
import {
  TRIP_DETAIL_INCLUDE,
  createTrip,
  softDeleteTrip,
  updateTrip,
  type TripDetail,
} from '@/server/services/trip';
import { seoSchema, type TripPatch } from '@/server/validators/trip';

import { McpToolError } from '../errors';
import { listModeSchema, mergeList, need, rowIndex, type ListMode } from '../list-merge';
import {
  assertUnchanged,
  changesFrom,
  defineRead,
  defineWrite,
  liveRecordEscalation,
  nothingToChange,
  stamp,
  type FieldChange,
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
 * Journeys — the catalogue, as tools.
 *
 * The editor's tabs, roughly one tool each, all through `updateTrip`: the same
 * service the panel's own Save calls, so slugs keep their redirects, rich text
 * loses its derived URLs and a save is one transaction, whichever door it came
 * in by. Prices are their own tool because a price always waits for a person;
 * everything else on a draft happens at once, and on a published journey
 * waits.
 */

const tripId = z.string().min(1).describe('The journey’s id, from trips_list.');

type Day = NonNullable<TripPatch['itinerary']>[number];
type Faq = NonNullable<TripPatch['faqs']>[number];
type Tier = NonNullable<TripPatch['pricingTiers']>[number];
type GalleryItem = NonNullable<TripPatch['gallery']>[number];

async function loadTrip(id: string): Promise<TripDetail> {
  const trip = await db.trip.findFirst({
    where: { id, deletedAt: null },
    include: TRIP_DETAIL_INCLUDE,
  });
  if (!trip) throw McpToolError.notFound('That journey', id);
  return trip;
}

/* -------------------------------------------------------------------------- */
/*  The lists, in the shape `updateTrip` takes them                            */
/* -------------------------------------------------------------------------- */

/**
 * Stored HTML, as stored.
 *
 * Not the plain text, and not the editor's resolved copy. A model that reads a
 * body, changes a sentence and sends it back must send back what was there —
 * plain text would flatten every heading, list and photograph in it, and the
 * resolved copy would put derived URLs back into the column. A photograph in a
 * body is `<figure data-media-id="…">`, which `updateTrip` keeps as it is.
 */
function daysOf(trip: TripDetail): Day[] {
  return trip.itinerary.map((day) => ({
    isRest: day.isRest,
    title: day.title,
    meta: day.meta,
    body: day.body,
    mediaIds: day.images.map((image) => image.mediaId),
  }));
}

/** A question names its heading by title — see `groupKey` in the validator. */
function faqsOf(trip: TripDetail): Faq[] {
  return trip.faqs.map((faq) => ({
    question: faq.question,
    answer: faq.answer,
    groupKey: trip.faqGroups.find((group) => group.id === faq.groupId)?.title ?? null,
  }));
}

function tiersOf(trip: TripDetail): Tier[] {
  return trip.pricingTiers.map((tier) => ({
    label: tier.label,
    minPeople: tier.minPeople,
    maxPeople: tier.maxPeople,
    priceUsd: tier.priceUsd,
    wasPriceUsd: tier.wasPriceUsd,
    note: tier.note,
  }));
}

function galleryOf(trip: TripDetail): GalleryItem[] {
  return trip.gallery.map((item) => ({
    mediaId: item.mediaId,
    ratio: item.ratio,
    width: item.width,
  }));
}

const indexed = <T>(rows: T[]) => rows.map((row, i) => ({ index: i + 1, ...row }));

/**
 * What a list edit changes, row by row, for the approval card.
 *
 * Positional, because positions are how the rows are addressed. A removal
 * reports the rows removed rather than every row after it shifting up one,
 * which is what a positional comparison would otherwise say.
 */
function listChanges<T>(
  noun: string,
  mode: ListMode,
  current: T[],
  next: T[],
  removedIndexes: number[] = [],
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  if (mode === 'remove') {
    for (const i of removedIndexes) changes[`${noun} ${i}`] = { from: current[i - 1], to: null };
    return changes;
  }
  for (let i = 0; i < Math.max(current.length, next.length); i += 1) {
    if (JSON.stringify(current[i] ?? null) !== JSON.stringify(next[i] ?? null)) {
      changes[`${noun} ${i + 1}`] = { from: current[i] ?? null, to: next[i] ?? null };
    }
  }
  return changes;
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                      */
/* -------------------------------------------------------------------------- */

const tripsList = defineRead({
  name: 'trips_list',
  title: 'List journeys',
  description:
    'Lists the journeys in the catalogue — drafts as well as published — with their status, ' +
    'length, from-price and how many itinerary days, departures and enquiries each has. ' +
    'Start here to find a journey’s id. Deleted journeys are not listed.',
  permission: 'trips.read',
  entityType: 'trip',
  schema: z
    .object({
      search: searchSchema,
      status: statusFilter,
      type: z.enum(['MINDFULNESS', 'MEDITATION', 'FESTIVAL', 'TREKKING']).optional(),
      limit: limitSchema,
    })
    .strict(),
  async run(input) {
    const where: Prisma.TripWhereInput = {
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.search
        ? {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { slug: { contains: input.search, mode: 'insensitive' } },
              { excerpt: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.trip.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        take: input.limit,
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          status: true,
          durationDays: true,
          priceFromUsd: true,
          featured: true,
          updatedAt: true,
          metaDescription: true,
          _count: { select: { itinerary: true, departures: true, enquiries: true } },
        },
      }),
      db.trip.count({ where }),
    ]);
    return {
      total,
      journeys: rows.map(({ _count, metaDescription, ...row }) => ({
        ...row,
        path: `/trips/${row.slug}`,
        itineraryDays: _count.itinerary,
        departures: _count.departures,
        enquiries: _count.enquiries,
        hasMetaDescription: Boolean(metaDescription),
      })),
    };
  },
});

const tripsGet = defineRead({
  name: 'trips_get',
  title: 'Read a journey',
  description:
    'Reads one journey in full: every field, the itinerary, FAQs, price tiers, photographs, ' +
    'SEO, upcoming departures and what still stops it being published. Rich text comes back ' +
    'as the stored HTML — keep the markup when you send a body back. List rows carry a ' +
    '1-based `index`, which is how the list tools address them. `version` is what to quote ' +
    'if you want a write refused when somebody else has changed it since.',
  permission: 'trips.read',
  entityType: 'trip',
  schema: z.object({ tripId }).strict(),
  async run({ tripId: id }) {
    const trip = await loadTrip(id);
    const problems = await problemsPublishingTrip(trip.id);

    return {
      id: trip.id,
      slug: trip.slug,
      path: `/trips/${trip.slug}`,
      status: trip.status,
      version: stamp(trip.updatedAt),
      publishedAt: stamp(trip.publishedAt),
      title: trip.title,
      type: trip.type,
      journeyLabel: trip.journeyLabel,
      excerpt: trip.excerpt,
      durationDays: trip.durationDays,
      nights: trip.nights,
      highPointMetres: trip.highPointMetres,
      difficulty: trip.difficulty,
      seasonLabel: trip.seasonLabel,
      seasonKeys: trip.seasonKeys,
      paceNote: trip.paceNote,
      groupSizeMin: trip.groupSizeMin,
      groupSizeMax: trip.groupSizeMax,
      regions: trip.regions,
      featured: trip.featured,
      overview: trip.overview,
      pricing: {
        priceFromUsd: trip.priceFromUsd,
        priceCurrency: trip.priceCurrency,
        priceNote: trip.priceNote,
        tiers: indexed(tiersOf(trip)),
      },
      highlights: indexed(trip.highlights.map((row) => ({ text: row.text }))),
      included: indexed(
        trip.inclusions.filter((row) => row.isIncluded).map((row) => ({ text: row.text })),
      ),
      excluded: indexed(
        trip.inclusions.filter((row) => !row.isIncluded).map((row) => ({ text: row.text })),
      ),
      itinerary: indexed(daysOf(trip)),
      faqGroups: trip.faqGroups.map((group) => ({ title: group.title, blurb: group.blurb })),
      faqs: indexed(faqsOf(trip)),
      images: {
        hero: mediaSummary(trip.hero),
        overviewImage: mediaSummary(trip.overviewImage),
        overviewInset: mediaSummary(trip.overviewInset),
        routeMap: mediaSummary(trip.routeMap),
        trailImage: mediaSummary(trip.trailImage),
      },
      gallery: indexed(
        trip.gallery.map((item) => ({ ...mediaSummary(item.media)!, ratio: item.ratio, width: item.width })),
      ),
      trail: { eyebrow: trip.trailEyebrow, title: trip.trailTitle, body: trip.trailBody },
      videoUrl: trip.videoUrl,
      bands: {
        showTrail: trip.showTrail,
        showGallery: trip.showGallery,
        showDestinations: trip.showDestinations,
        showCulture: trip.showCulture,
        showJournal: trip.showJournal,
        showRelated: trip.showRelated,
      },
      route: trip.destinations.map((link) => link.destination.name),
      departures: trip.departures
        .filter((departure) => departure.startDate >= new Date())
        .map((departure) => ({
          id: departure.id,
          startDate: departure.startDate.toISOString().slice(0, 10),
          endDate: departure.endDate.toISOString().slice(0, 10),
          priceUsd: departure.priceUsd,
          status: departure.status,
          placesLeft: departure.placesLeft,
          isFixed: departure.isFixed,
        })),
      seo: seoSummary(trip),
      publishProblems: problems,
    };
  },
});

const tripsPublishCheck = defineRead({
  name: 'trips_publish_check',
  title: 'What stops a journey going live',
  description:
    'Says what stops a journey being published, each with the field to fix and why — the ' +
    'same rules the panel’s Publish button applies. An empty list means it is ready.',
  permission: 'trips.read',
  entityType: 'trip',
  schema: z.object({ tripId }).strict(),
  async run({ tripId: id }) {
    const trip = await loadTrip(id);
    const problems = await problemsPublishingTrip(trip.id);
    return { id: trip.id, title: trip.title, status: trip.status, ready: problems.length === 0, problems };
  },
});

/* -------------------------------------------------------------------------- */
/*  The section tools                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The four things every section tool does, written once: load the journey,
 * work out what would change, lock on its `updatedAt`, and hand the section
 * to `updateTrip`.
 *
 * `build` runs twice — in `prepare` against the journey as it was, and in
 * `execute` against the journey as it is — and the lock between them means
 * the two answers are the same. Building again rather than trusting the
 * stored patch is what keeps an approved patch-mode edit meaning "change day
 * three", not "write this whole list I worked out an hour ago".
 */
function tripSection<S extends z.ZodObject<{ tripId: typeof tripId } & z.ZodRawShape>>(def: {
  name: string;
  title: string;
  section: string;
  description: string;
  schema: S;
  risk: McpRisk;
  requiresApproval?: boolean;
  /** SEO does not escalate on a live journey; content does. */
  escalateWhenLive?: boolean;
  build(input: z.infer<S>, trip: TripDetail): Promise<{
    patch: TripPatch;
    changes: Record<string, FieldChange>;
  }>;
}): ToolDefinition {
  return defineWrite({
    name: def.name,
    title: def.title,
    description: def.description,
    permission: 'trips.write',
    entityType: 'trip',
    schema: def.schema,
    risk: def.risk,
    requiresApproval: def.requiresApproval ?? false,

    async prepare(input) {
      const trip = await loadTrip((input as { tripId: string }).tripId);
      const { changes } = await def.build(input, trip);
      if (Object.keys(changes).length === 0) nothingToChange();
      return {
        entityType: 'trip',
        entityId: trip.id,
        entityLabel: trip.title,
        summary: `Change the ${def.section} of the journey “${trip.title}”`,
        proposedChanges: changes,
        preconditions: { updatedAt: stamp(trip.updatedAt) },
        escalation:
          def.escalateWhenLive === false ? null : liveRecordEscalation(trip, 'journey'),
      };
    },

    async execute(input, prepared, actor) {
      const trip = await loadTrip((input as { tripId: string }).tripId);
      assertUnchanged(prepared.preconditions, { updatedAt: stamp(trip.updatedAt) });

      const { patch, changes } = await def.build(input, trip);
      const updated = await updateTrip(trip.id, patch);

      recordAiActivity(actor, {
        action: 'UPDATE',
        entity: 'trip',
        entityId: updated.id,
        entityLabel: updated.title,
        before: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])) as never,
        after: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])) as never,
      });

      const paths = [`/trips/${updated.slug}`];
      if (trip.slug !== updated.slug) paths.push(`/trips/${trip.slug}`);
      pushToSite('trip', paths);

      return {
        entityId: updated.id,
        entityLabel: updated.title,
        data: {
          id: updated.id,
          slug: updated.slug,
          path: `/trips/${updated.slug}`,
          status: updated.status,
          version: stamp(updated.updatedAt),
          changed: Object.keys(changes),
        },
      };
    },
  });
}

const tripsUpdate = tripSection({
  name: 'trips_update',
  title: 'Edit a journey’s details and overview',
  section: 'details',
  description:
    'Edits a journey’s words and facts: title, slug, excerpt, overview, length, difficulty, ' +
    'season, pace, group size, the region line, the trail band and which bands the page ' +
    'shows. Send only the fields to change. Not prices (trips_update_pricing), not the ' +
    'itinerary, FAQs, highlights or photographs (their own tools), not SEO ' +
    '(trips_update_seo), not publishing (trips_publish). On a draft it happens at once; on ' +
    'a published journey it waits for approval. Changing the slug keeps the old address ' +
    'working with a redirect.',
  risk: 'MEDIUM',
  schema: z
    .object({
      tripId,
      title: z.string().min(1).max(200).optional(),
      slug: z.string().min(1).max(140).optional(),
      excerpt: z.string().max(600).optional().describe('The card’s summary sentence.'),
      type: z.enum(['MINDFULNESS', 'MEDITATION', 'FESTIVAL', 'TREKKING']).optional(),
      journeyLabel: z.string().max(120).optional(),
      overview: richTextSchema
        .nullable()
        .optional()
        .describe('HTML. The opening prose under the hero. Keep the markup you read.'),
      durationDays: z.number().int().min(1).max(60).optional(),
      nights: z.number().int().min(0).max(60).optional(),
      highPointMetres: z.number().int().min(0).max(9_000).optional(),
      difficulty: z.enum(['GENTLE', 'MODERATE', 'DEMANDING']).optional(),
      seasonLabel: z.string().max(120).optional(),
      seasonKeys: z.array(z.enum(['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'])).optional(),
      paceNote: z.string().max(400).optional(),
      groupSizeMin: z.number().int().min(1).max(60).nullable().optional(),
      groupSizeMax: z.number().int().min(1).max(60).nullable().optional(),
      regions: z
        .array(z.string().max(80))
        .max(20)
        .optional()
        .describe('The region line, as names. The site joins them; send the whole list.'),
      trailEyebrow: z.string().max(60).optional(),
      trailTitle: z.string().max(120).optional(),
      trailBody: z.string().max(400).optional(),
      videoUrl: z.string().max(500).nullable().optional(),
      featured: z.boolean().optional(),
      showTrail: z.boolean().optional(),
      showGallery: z.boolean().optional(),
      showDestinations: z.boolean().optional(),
      showCulture: z.boolean().optional(),
      showJournal: z.boolean().optional(),
      showRelated: z.boolean().optional(),
    })
    .strict(),
  async build({ tripId: _id, ...fields }, trip) {
    const nights = fields.nights ?? trip.nights;
    const days = fields.durationDays ?? trip.durationDays;
    if (nights > days) {
      throw new McpToolError('VALIDATION_ERROR', `There cannot be more nights (${nights}) than days (${days}).`);
    }
    const min = fields.groupSizeMin === undefined ? trip.groupSizeMin : fields.groupSizeMin;
    const max = fields.groupSizeMax === undefined ? trip.groupSizeMax : fields.groupSizeMax;
    if (min != null && max != null && min > max) {
      throw new McpToolError('VALIDATION_ERROR', 'The smallest group cannot be larger than the largest.');
    }
    const changes = changesFrom(trip as unknown as Record<string, unknown>, fields);
    return { patch: fields, changes };
  },
});

const tierRow = z
  .object({
    index: rowIndex,
    label: z.string().min(1).max(120).optional().describe('"Two travellers".'),
    minPeople: z.number().int().min(1).max(60).optional(),
    maxPeople: z.number().int().min(1).max(60).nullable().optional(),
    priceUsd: z.number().int().min(0).max(1_000_000).optional(),
    wasPriceUsd: z.number().int().min(0).max(1_000_000).nullable().optional(),
    note: z.string().max(400).nullable().optional(),
  })
  .strict();

const tripsUpdatePricing = tripSection({
  name: 'trips_update_pricing',
  title: 'Change a journey’s prices',
  section: 'prices',
  description:
    'Changes what a journey costs: the from-price, the currency, the note under it and the ' +
    'per-group-size tiers. Always waits for an administrator to approve it, draft or not — a ' +
    'price is a price. Tiers take a `mode`; see the field. Departure prices are ' +
    'departures_update.',
  risk: 'HIGH',
  requiresApproval: true,
  schema: z
    .object({
      tripId,
      priceFromUsd: z.number().int().min(0).max(1_000_000).optional(),
      priceCurrency: z.string().length(3).optional(),
      priceNote: richTextSchema.nullable().optional(),
      tiers: z.array(tierRow).max(12).optional(),
      tiersMode: listModeSchema,
    })
    .strict(),
  async build({ tripId: _id, tiers, tiersMode, ...fields }, trip) {
    const changes = changesFrom(trip as unknown as Record<string, unknown>, fields);
    const patch: TripPatch = { ...fields };

    if (tiers) {
      const current = tiersOf(trip);
      const next = mergeList({
        noun: 'tier',
        current,
        rows: tiers,
        mode: tiersMode,
        max: 12,
        toFull: (row, existing) => ({
          label: need(row.label ?? existing?.label, 'label', 'tier'),
          minPeople: need(row.minPeople ?? existing?.minPeople, 'minPeople', 'tier'),
          maxPeople: row.maxPeople === undefined ? (existing?.maxPeople ?? null) : row.maxPeople,
          priceUsd: need(row.priceUsd ?? existing?.priceUsd, 'priceUsd', 'tier'),
          wasPriceUsd: row.wasPriceUsd === undefined ? (existing?.wasPriceUsd ?? null) : row.wasPriceUsd,
          note: row.note === undefined ? (existing?.note ?? null) : row.note,
        }),
      });
      Object.assign(changes, listChanges('tier', tiersMode, current, next, tiers.map((t) => t.index ?? 0)));
      patch.pricingTiers = next;
    }
    return { patch, changes };
  },
});

const dayRow = z
  .object({
    index: rowIndex,
    title: z.string().min(1).max(200).optional(),
    meta: z.string().max(200).nullable().optional().describe('"Paro · 2,280 m · 4 h drive".'),
    body: richTextSchema.nullable().optional().describe('HTML. Keep the markup you read.'),
    isRest: z.boolean().optional(),
    mediaIds: z.array(z.string()).max(8).optional().describe('The day’s photographs, library ids.'),
  })
  .strict();

const tripsUpdateItinerary = tripSection({
  name: 'trips_update_itinerary',
  title: 'Edit a journey’s day-by-day',
  section: 'itinerary',
  description:
    'Edits the itinerary. Default `mode: "patch"` changes only the days you send, each with ' +
    'its 1-based `index` from trips_get — so to rewrite day 3, send day 3 alone. `append` ' +
    'adds days at the end, `remove` deletes the days you name, `replace` rewrites the whole ' +
    'itinerary. On a published journey it waits for approval.',
  risk: 'MEDIUM',
  schema: z
    .object({ tripId, days: z.array(dayRow).min(1).max(60), mode: listModeSchema })
    .strict(),
  async build({ days, mode }, trip) {
    await assertMediaExists(days.flatMap((day) => day.mediaIds ?? []));
    const current = daysOf(trip);
    const next = mergeList({
      noun: 'day',
      current,
      rows: days,
      mode,
      max: 60,
      toFull: (row, existing) => ({
        title: need(row.title ?? existing?.title, 'title', 'day'),
        meta: row.meta === undefined ? (existing?.meta ?? null) : row.meta,
        body: row.body === undefined ? (existing?.body ?? null) : row.body,
        isRest: row.isRest ?? existing?.isRest ?? false,
        mediaIds: row.mediaIds ?? existing?.mediaIds ?? [],
      }),
    });
    return {
      patch: { itinerary: next },
      changes: listChanges('day', mode, current, next, days.map((d) => d.index ?? 0)),
    };
  },
});

const faqRow = z
  .object({
    index: rowIndex,
    question: z.string().min(1).max(300).optional(),
    answer: richTextSchema.optional().describe('HTML.'),
    group: z
      .string()
      .max(200)
      .nullable()
      .optional()
      .describe('The title of an existing FAQ heading from trips_get, or null for none.'),
  })
  .strict();

const tripsUpdateFaqs = tripSection({
  name: 'trips_update_faqs',
  title: 'Edit a journey’s questions and answers',
  section: 'FAQs',
  description:
    'Edits the journey’s FAQs. Default `mode: "patch"` changes only the questions you send, ' +
    'by 1-based `index`; `append` adds, `remove` deletes, `replace` rewrites them all. An FAQ ' +
    'belongs here, never written into the overview, where no search result can find it. On ' +
    'a published journey it waits for approval.',
  risk: 'MEDIUM',
  schema: z
    .object({ tripId, faqs: z.array(faqRow).min(1).max(60), mode: listModeSchema })
    .strict(),
  async build({ faqs, mode }, trip) {
    const headings = new Set(trip.faqGroups.map((group) => group.title));
    for (const faq of faqs) {
      if (faq.group && !headings.has(faq.group)) {
        throw new McpToolError(
          'VALIDATION_ERROR',
          `There is no FAQ heading called “${faq.group}”. The headings are: ${[...headings].join(', ') || 'none'}.`,
        );
      }
    }
    const current = faqsOf(trip);
    const next = mergeList({
      noun: 'question',
      current,
      rows: faqs,
      mode,
      max: 60,
      toFull: (row, existing) => ({
        question: need(row.question ?? existing?.question, 'question', 'question'),
        answer: need(row.answer ?? existing?.answer, 'answer', 'question'),
        groupKey: row.group === undefined ? (existing?.groupKey ?? null) : row.group,
      }),
    });
    return {
      patch: { faqs: next },
      changes: listChanges('question', mode, current, next, faqs.map((f) => f.index ?? 0)),
    };
  },
});

const textRow = z.object({ index: rowIndex, text: z.string().min(1).max(400).optional() }).strict();
const textList = z
  .object({ items: z.array(textRow).min(1).max(40), mode: listModeSchema })
  .strict()
  .optional();

const tripsUpdateInclusions = tripSection({
  name: 'trips_update_inclusions',
  title: 'Edit highlights and what is included',
  section: 'highlights and inclusions',
  description:
    'Edits three short lists: `highlights`, `included` (what the price covers) and ' +
    '`excluded` (what it does not). Each takes its own `items` and `mode` — patch by ' +
    '1-based index, append, remove or replace — and a list you leave out is untouched. On a ' +
    'published journey it waits for approval.',
  risk: 'MEDIUM',
  schema: z
    .object({ tripId, highlights: textList, included: textList, excluded: textList })
    .strict(),
  async build({ highlights, included, excluded }, trip) {
    const patch: TripPatch = {};
    const changes: Record<string, FieldChange> = {};
    const lists = {
      highlights: { edit: highlights, current: trip.highlights.map((row) => row.text), max: 30 },
      included: {
        edit: included,
        current: trip.inclusions.filter((row) => row.isIncluded).map((row) => row.text),
        max: 40,
      },
      excluded: {
        edit: excluded,
        current: trip.inclusions.filter((row) => !row.isIncluded).map((row) => row.text),
        max: 40,
      },
    };
    for (const [key, { edit, current, max }] of Object.entries(lists)) {
      if (!edit) continue;
      const noun = key === 'highlights' ? 'highlight' : key === 'included' ? 'included item' : 'excluded item';
      const next = mergeList({
        noun,
        current,
        rows: edit.items,
        mode: edit.mode,
        max,
        toFull: (row, existing) => need(row.text ?? existing, 'text', noun),
      });
      patch[key as 'highlights'] = next;
      Object.assign(changes, listChanges(noun, edit.mode, current, next, edit.items.map((i) => i.index ?? 0)));
    }
    return { patch, changes };
  },
});

const galleryRow = z
  .object({
    index: rowIndex,
    mediaId: z.string().optional(),
    ratio: z.string().max(12).nullable().optional().describe('CSS aspect ratio, e.g. "3/4".'),
    width: z.string().max(8).nullable().optional(),
  })
  .strict();

const imageId = z.string().nullable().optional();

const tripsUpdateMedia = tripSection({
  name: 'trips_update_media',
  title: 'Set a journey’s photographs',
  section: 'photographs',
  description:
    'Sets the journey’s photographs: the hero, the pair beside the overview, the route map, ' +
    'the trail band’s image, and the gallery (with `galleryMode`). Every field takes a media ' +
    'library id — find one with media_search or add one with media_upload — never a URL. ' +
    'null clears a slot. On a published journey it waits for approval.',
  risk: 'MEDIUM',
  schema: z
    .object({
      tripId,
      heroId: imageId,
      overviewImageId: imageId,
      overviewInsetId: imageId,
      routeMapId: imageId,
      trailImageId: imageId,
      gallery: z.array(galleryRow).max(60).optional(),
      galleryMode: listModeSchema,
    })
    .strict(),
  async build({ tripId: _id, gallery, galleryMode, ...slots }, trip) {
    await assertMediaExists([...Object.values(slots), ...(gallery ?? []).map((row) => row.mediaId)]);
    const changes = changesFrom(trip as unknown as Record<string, unknown>, slots);
    const patch: TripPatch = { ...slots };
    if (gallery) {
      const current = galleryOf(trip);
      const next = mergeList({
        noun: 'gallery photograph',
        current,
        rows: gallery,
        mode: galleryMode,
        max: 60,
        toFull: (row, existing) => ({
          mediaId: need(row.mediaId ?? existing?.mediaId, 'mediaId', 'gallery photograph'),
          ratio: row.ratio === undefined ? (existing?.ratio ?? null) : row.ratio,
          width: row.width === undefined ? (existing?.width ?? null) : row.width,
        }),
      });
      patch.gallery = next;
      Object.assign(changes, listChanges('gallery photograph', galleryMode, current, next, gallery.map((g) => g.index ?? 0)));
    }
    return { patch, changes };
  },
});

const tripsUpdateSeo = tripSection({
  name: 'trips_update_seo',
  title: 'Edit a journey’s SEO',
  section: 'SEO',
  description:
    'Edits how a journey appears in search and when shared: meta title and description, ' +
    'canonical URL, noindex, Open Graph title, description and image, keywords. Happens at ' +
    'once even on a published journey — these change no visible words on the page. Send ' +
    'only what changes.',
  risk: 'LOW',
  escalateWhenLive: false,
  schema: z.object({ tripId, seo: seoSchema.omit({ schemaJson: true }).strict() }).strict(),
  async build({ seo }, trip) {
    await assertMediaExists([seo.ogImageId]);
    return {
      patch: { seo },
      changes: changesFrom(trip as unknown as Record<string, unknown>, seo),
    };
  },
});

/* -------------------------------------------------------------------------- */
/*  Create, publish, unpublish, delete                                         */
/* -------------------------------------------------------------------------- */

const tripsCreate = defineWrite({
  name: 'trips_create',
  title: 'Start a new journey',
  description:
    'Creates a new journey as a draft, which nobody outside the office can see. Give it a ' +
    'title and whatever is known; fill the rest in with the trips_update_* tools, then ' +
    'trips_publish_check and trips_publish. Prices set here still need trips_update_pricing.',
  permission: 'trips.write',
  entityType: 'trip',
  risk: 'LOW',
  requiresApproval: false,
  schema: z
    .object({
      title: z.string().min(1).max(200),
      excerpt: z.string().max(600).optional(),
      type: z.enum(['MINDFULNESS', 'MEDITATION', 'FESTIVAL', 'TREKKING']).optional(),
      durationDays: z.number().int().min(1).max(60).optional(),
      nights: z.number().int().min(0).max(60).optional(),
      difficulty: z.enum(['GENTLE', 'MODERATE', 'DEMANDING']).optional(),
      regions: z.array(z.string().max(80)).max(20).optional(),
      overview: richTextSchema.nullable().optional(),
    })
    .strict(),
  async prepare(input) {
    return {
      entityType: 'trip',
      entityId: null,
      entityLabel: input.title,
      summary: `Start a draft journey called “${input.title}”`,
      proposedChanges: Object.fromEntries(
        Object.entries(input).map(([field, to]) => [field, { from: null, to }]),
      ),
      preconditions: {},
    };
  },
  async execute(input, _prepared, actor) {
    const trip = await createTrip({ ...input, status: 'DRAFT' });
    recordAiActivity(actor, { action: 'CREATE', entity: 'trip', entityId: trip.id, entityLabel: trip.title });
    return {
      entityId: trip.id,
      entityLabel: trip.title,
      data: { id: trip.id, slug: trip.slug, status: trip.status, version: stamp(trip.updatedAt) },
    };
  },
});

function statusChange(def: {
  name: string;
  title: string;
  description: string;
  permission: Permission;
  risk: McpRisk;
  verb: string;
  to: 'PUBLISHED' | 'DRAFT';
  from: (status: string) => boolean;
  fromMessage: string;
}): ToolDefinition {
  return defineWrite({
    name: def.name,
    title: def.title,
    description: def.description,
    permission: def.permission,
    entityType: 'trip',
    risk: def.risk,
    requiresApproval: true,
    schema: z.object({ tripId }).strict(),
    async prepare({ tripId: id }) {
      const trip = await loadTrip(id);
      if (!def.from(trip.status)) {
        throw new McpToolError('CONFLICT', `“${trip.title}” is ${trip.status.toLowerCase()}; ${def.fromMessage}`);
      }
      if (def.to === 'PUBLISHED') await refuseIfNotReady(trip.id, trip.title);
      return {
        entityType: 'trip',
        entityId: trip.id,
        entityLabel: trip.title,
        summary: `${def.verb} the journey “${trip.title}”`,
        proposedChanges: { status: { from: trip.status, to: def.to } },
        preconditions: { updatedAt: stamp(trip.updatedAt), status: trip.status },
      };
    },
    async execute({ tripId: id }, prepared, actor) {
      const trip = await loadTrip(id);
      assertUnchanged(prepared.preconditions, { updatedAt: stamp(trip.updatedAt), status: trip.status });
      if (def.to === 'PUBLISHED') await refuseIfNotReady(trip.id, trip.title);

      const updated = await updateTrip(trip.id, { status: def.to });
      recordAiActivity(actor, {
        action: def.to === 'PUBLISHED' ? 'PUBLISH' : 'UNPUBLISH',
        entity: 'trip',
        entityId: updated.id,
        entityLabel: updated.title,
        before: { status: trip.status },
        after: { status: updated.status },
      });
      pushToSite('trip', [`/trips/${updated.slug}`]);
      return {
        entityId: updated.id,
        entityLabel: updated.title,
        data: { id: updated.id, path: `/trips/${updated.slug}`, status: updated.status },
      };
    },
  });
}

/**
 * Refused at `prepare`, which is the point of preparing: nobody is asked to
 * approve something that cannot run. Checked again at `execute`, because the
 * hero's alt text can be cleared while the card waits.
 */
async function refuseIfNotReady(id: string, title: string): Promise<void> {
  const problems = await problemsPublishingTrip(id);
  if (problems.length > 0) {
    throw new McpToolError('NOT_READY', `“${title}” is not ready to be published.`, { problems });
  }
}

const tripsPublish = statusChange({
  name: 'trips_publish',
  title: 'Publish a journey',
  description:
    'Puts a journey on the website. Always waits for an administrator to approve it, and is ' +
    'refused straight away if trips_publish_check reports anything.',
  permission: 'trips.publish',
  risk: 'HIGH',
  verb: 'Publish',
  to: 'PUBLISHED',
  from: (status) => status !== 'PUBLISHED',
  fromMessage: 'it is already published.',
});

const tripsUnpublish = statusChange({
  name: 'trips_unpublish',
  title: 'Take a journey off the website',
  description:
    'Returns a published journey to draft, taking its page off the website. Always waits ' +
    'for an administrator to approve it. Its page stops answering until it is published ' +
    'again — say so to the person asking.',
  permission: 'trips.publish',
  risk: 'HIGH',
  verb: 'Unpublish',
  to: 'DRAFT',
  from: (status) => status === 'PUBLISHED' || status === 'SCHEDULED',
  fromMessage: 'only a published or scheduled journey can be unpublished.',
});

const tripsDelete = defineWrite({
  name: 'trips_delete',
  title: 'Delete a journey',
  description:
    'Deletes a journey — recoverably, from the Journeys screen, but it leaves the website ' +
    'at once. Always waits for an administrator, whatever the policy says. Prefer ' +
    'trips_unpublish unless the person asked for it to be deleted.',
  permission: 'trips.delete',
  entityType: 'trip',
  risk: 'CRITICAL',
  requiresApproval: true,
  schema: z.object({ tripId }).strict(),
  async prepare({ tripId: id }) {
    const trip = await loadTrip(id);
    return {
      entityType: 'trip',
      entityId: trip.id,
      entityLabel: trip.title,
      summary: `Delete the journey “${trip.title}”${trip.status === 'PUBLISHED' ? ', which is published' : ''}`,
      proposedChanges: { deleted: { from: false, to: true }, status: { from: trip.status, to: 'ARCHIVED' } },
      preconditions: { updatedAt: stamp(trip.updatedAt) },
    };
  },
  async execute({ tripId: id }, prepared, actor) {
    const trip = await loadTrip(id);
    assertUnchanged(prepared.preconditions, { updatedAt: stamp(trip.updatedAt) });
    await softDeleteTrip(trip.id);
    recordAiActivity(actor, { action: 'DELETE', entity: 'trip', entityId: trip.id, entityLabel: trip.title });
    pushToSite('trip', [`/trips/${trip.slug}`]);
    return { entityId: trip.id, entityLabel: trip.title, data: { id: trip.id, deleted: true } };
  },
});

export const TRIP_TOOLS: ToolDefinition[] = [
  tripsList,
  tripsGet,
  tripsPublishCheck,
  tripsCreate,
  tripsUpdate,
  tripsUpdatePricing,
  tripsUpdateItinerary,
  tripsUpdateFaqs,
  tripsUpdateInclusions,
  tripsUpdateMedia,
  tripsUpdateSeo,
  tripsPublish,
  tripsUnpublish,
  tripsDelete,
];
