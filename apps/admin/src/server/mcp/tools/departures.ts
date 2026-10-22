import 'server-only';

import type { Departure } from '@prisma/client';
import { z } from 'zod';

import { db } from '@/lib/db';

import { McpToolError } from '../errors';
import {
  assertUnchanged,
  changesFrom,
  defineRead,
  defineWrite,
  nothingToChange,
  stamp,
  type ToolDefinition,
} from '../operation';
import { pushToSite, recordAiActivity } from './shared';

/**
 * Departures — the dates a journey runs, and what each costs.
 *
 * Every new date and every price waits for a person: a departure on the
 * website is a promise to a traveller, and its price is the number they are
 * quoted. Notes, places left and the open/closed status on an existing date
 * are the desk's daily work and happen at once, unless they move a price.
 */

const departureId = z.string().min(1).describe('The departure’s id, from departures_list.');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'A date as YYYY-MM-DD.')
  .describe('YYYY-MM-DD.');

const STATUS = z.enum(['OPEN', 'GUARANTEED', 'FEW_PLACES', 'CLOSED', 'CANCELLED']);

type WithTrip = Departure & { trip: { id: string; title: string; slug: string; status: string } };

async function loadDeparture(id: string): Promise<WithTrip & { _count: { bookings: number } }> {
  const row = await db.departure.findUnique({
    where: { id },
    include: {
      trip: { select: { id: true, title: true, slug: true, status: true } },
      _count: { select: { bookings: true } },
    },
  });
  if (!row) throw McpToolError.notFound('That departure', id);
  return row;
}

const label = (row: { trip: { title: string }; startDate: Date }) =>
  `${row.trip.title} — ${row.startDate.toISOString().slice(0, 10)}`;

function view(row: WithTrip) {
  return {
    id: row.id,
    journey: { id: row.trip.id, title: row.trip.title },
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    priceUsd: row.priceUsd,
    wasPriceUsd: row.wasPriceUsd,
    placesTotal: row.placesTotal,
    placesLeft: row.placesLeft,
    status: row.status,
    isFixed: row.isFixed,
    isPublished: row.isPublished,
    note: row.note,
    version: stamp(row.updatedAt),
  };
}

const departuresList = defineRead({
  name: 'departures_list',
  title: 'List departures',
  description:
    'Lists departure dates, soonest first — upcoming ones unless `past` is true — with price, ' +
    'places left and status. Pass `tripId` for one journey’s dates.',
  permission: 'departures.read',
  entityType: 'departure',
  schema: z
    .object({
      tripId: z.string().optional(),
      past: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict(),
  async run(input) {
    const rows = await db.departure.findMany({
      where: {
        ...(input.tripId ? { tripId: input.tripId } : {}),
        startDate: input.past ? { lt: new Date() } : { gte: new Date() },
      },
      orderBy: { startDate: input.past ? 'desc' : 'asc' },
      take: input.limit,
      include: { trip: { select: { id: true, title: true, slug: true, status: true } } },
    });
    return { departures: rows.map(view) };
  },
});

const departuresCreate = defineWrite({
  name: 'departures_create',
  title: 'Add a departure date',
  description:
    'Adds a date a journey runs, with its price. Always waits for an administrator to ' +
    'approve it — a date on the website is a promise to a traveller. `isFixed` means it runs ' +
    'whoever books; otherwise it is a suggested date.',
  permission: 'departures.write',
  entityType: 'departure',
  risk: 'HIGH',
  requiresApproval: true,
  schema: z
    .object({
      tripId: z.string().min(1),
      startDate: isoDate,
      endDate: isoDate,
      priceUsd: z.number().int().min(0).max(1_000_000),
      wasPriceUsd: z.number().int().min(0).max(1_000_000).nullable().optional(),
      placesTotal: z.number().int().min(1).max(60).nullable().optional(),
      placesLeft: z.number().int().min(0).max(60).nullable().optional(),
      status: STATUS.default('OPEN'),
      isFixed: z.boolean().default(false),
      isPublished: z.boolean().default(true),
      note: z.string().max(300).nullable().optional(),
    })
    .strict(),
  async prepare(input) {
    const trip = await db.trip.findFirst({
      where: { id: input.tripId, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!trip) throw McpToolError.notFound('That journey', input.tripId);
    checkDates(input.startDate, input.endDate, input.placesTotal, input.placesLeft);
    return {
      entityType: 'departure',
      entityId: null,
      entityLabel: `${trip.title} — ${input.startDate}`,
      summary: `Add a departure of “${trip.title}” on ${input.startDate} at US$${input.priceUsd}`,
      proposedChanges: Object.fromEntries(
        Object.entries(input).map(([field, to]) => [field, { from: null, to }]),
      ),
      preconditions: {},
    };
  },
  async execute(input, _prepared, actor) {
    const row = await db.departure.create({
      data: {
        tripId: input.tripId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        priceUsd: input.priceUsd,
        wasPriceUsd: input.wasPriceUsd ?? null,
        placesTotal: input.placesTotal ?? null,
        placesLeft: input.placesLeft ?? null,
        status: input.status,
        isFixed: input.isFixed,
        isPublished: input.isPublished,
        note: input.note || null,
      },
      include: { trip: { select: { id: true, title: true, slug: true, status: true } } },
    });
    recordAiActivity(actor, { action: 'CREATE', entity: 'departure', entityId: row.id, entityLabel: label(row) });
    pushToSite('departure', [`/trips/${row.trip.slug}`]);
    return { entityId: row.id, entityLabel: label(row), data: view(row) };
  },
});

function checkDates(
  start: string,
  end: string,
  total: number | null | undefined,
  left: number | null | undefined,
) {
  if (new Date(end) <= new Date(start)) {
    throw new McpToolError('VALIDATION_ERROR', 'A departure has to end after it starts.');
  }
  if (total != null && left != null && left > total) {
    throw new McpToolError('VALIDATION_ERROR', 'There cannot be more places left than places.');
  }
}

const departuresUpdate = defineWrite({
  name: 'departures_update',
  title: 'Edit a departure',
  description:
    'Edits a departure: dates, places, status, note, whether it shows on the site, or its ' +
    'price. A change to the price or the dates waits for approval; places left, the status ' +
    'and the note happen at once. To cancel one, use departures_cancel.',
  permission: 'departures.write',
  entityType: 'departure',
  risk: 'MEDIUM',
  requiresApproval: false,
  schema: z
    .object({
      departureId,
      startDate: isoDate.optional(),
      endDate: isoDate.optional(),
      priceUsd: z.number().int().min(0).max(1_000_000).optional(),
      wasPriceUsd: z.number().int().min(0).max(1_000_000).nullable().optional(),
      placesTotal: z.number().int().min(0).max(60).nullable().optional(),
      placesLeft: z.number().int().min(0).max(60).nullable().optional(),
      status: STATUS.exclude(['CANCELLED']).optional(),
      isFixed: z.boolean().optional(),
      isPublished: z.boolean().optional(),
      note: z.string().max(300).nullable().optional(),
    })
    .strict(),
  async prepare({ departureId: id, ...fields }) {
    const row = await loadDeparture(id);
    const current = {
      ...row,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
    };
    const changes = changesFrom(current as unknown as Record<string, unknown>, fields);
    if (Object.keys(changes).length === 0) nothingToChange();

    checkDates(
      fields.startDate ?? current.startDate,
      fields.endDate ?? current.endDate,
      fields.placesTotal === undefined ? row.placesTotal : fields.placesTotal,
      fields.placesLeft === undefined ? row.placesLeft : fields.placesLeft,
    );

    /* A price or a date a traveller may already have been quoted. */
    const moving = ['priceUsd', 'wasPriceUsd', 'startDate', 'endDate'].filter((f) => f in changes);
    return {
      entityType: 'departure',
      entityId: row.id,
      entityLabel: label(row),
      summary: `Change the departure of “${row.trip.title}” on ${current.startDate}`,
      proposedChanges: changes,
      preconditions: { updatedAt: stamp(row.updatedAt) },
      escalation: moving.length
        ? `It changes the ${moving.join(' and ')} of a departure${row._count.bookings ? ` that already has ${row._count.bookings} booking(s)` : ''}.`
        : null,
    };
  },
  async execute({ departureId: id, ...fields }, prepared, actor) {
    const before = await loadDeparture(id);
    assertUnchanged(prepared.preconditions, { updatedAt: stamp(before.updatedAt) });
    const row = await db.departure.update({
      where: { id },
      data: {
        ...(fields.startDate ? { startDate: new Date(fields.startDate) } : {}),
        ...(fields.endDate ? { endDate: new Date(fields.endDate) } : {}),
        priceUsd: fields.priceUsd,
        wasPriceUsd: fields.wasPriceUsd,
        placesTotal: fields.placesTotal,
        placesLeft: fields.placesLeft,
        status: fields.status,
        isFixed: fields.isFixed,
        isPublished: fields.isPublished,
        note: fields.note === undefined ? undefined : fields.note || null,
      },
      include: { trip: { select: { id: true, title: true, slug: true, status: true } } },
    });
    recordAiActivity(actor, {
      action: 'UPDATE',
      entity: 'departure',
      entityId: row.id,
      entityLabel: label(row),
      before: Object.fromEntries(Object.entries(prepared.proposedChanges).map(([k, v]) => [k, v.from])) as never,
      after: Object.fromEntries(Object.entries(prepared.proposedChanges).map(([k, v]) => [k, v.to])) as never,
    });
    pushToSite('departure', [`/trips/${row.trip.slug}`]);
    return { entityId: row.id, entityLabel: label(row), data: view(row) };
  },
});

const departuresCancel = defineWrite({
  name: 'departures_cancel',
  title: 'Cancel a departure',
  description:
    'Marks a departure cancelled. Always waits for an administrator. It does not touch the ' +
    'bookings on it, refund anybody or write to anybody — say so to the person asking, and ' +
    'that the travellers need contacting.',
  permission: 'departures.write',
  entityType: 'departure',
  risk: 'HIGH',
  requiresApproval: true,
  schema: z.object({ departureId }).strict(),
  async prepare({ departureId: id }) {
    const row = await loadDeparture(id);
    if (row.status === 'CANCELLED') {
      throw new McpToolError('CONFLICT', 'That departure is already cancelled.');
    }
    return {
      entityType: 'departure',
      entityId: row.id,
      entityLabel: label(row),
      summary:
        `Cancel the departure of “${row.trip.title}” on ${row.startDate.toISOString().slice(0, 10)}` +
        (row._count.bookings ? ` — it has ${row._count.bookings} booking(s), which are not changed` : ''),
      proposedChanges: { status: { from: row.status, to: 'CANCELLED' } },
      preconditions: { updatedAt: stamp(row.updatedAt), status: row.status },
    };
  },
  async execute({ departureId: id }, prepared, actor) {
    const before = await loadDeparture(id);
    assertUnchanged(prepared.preconditions, { updatedAt: stamp(before.updatedAt), status: before.status });
    const row = await db.departure.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { trip: { select: { id: true, title: true, slug: true, status: true } } },
    });
    recordAiActivity(actor, {
      action: 'UPDATE',
      entity: 'departure',
      entityId: row.id,
      entityLabel: label(row),
      before: { status: before.status },
      after: { status: 'CANCELLED' },
    });
    pushToSite('departure', [`/trips/${row.trip.slug}`]);
    return { entityId: row.id, entityLabel: label(row), data: view(row) };
  },
});

const departuresDelete = defineWrite({
  name: 'departures_delete',
  title: 'Delete a departure',
  description:
    'Deletes a departure date outright. Always waits for an administrator. Refused if any ' +
    'booking is on it — cancel it with departures_cancel instead.',
  permission: 'departures.delete',
  entityType: 'departure',
  risk: 'HIGH',
  requiresApproval: true,
  schema: z.object({ departureId }).strict(),
  async prepare({ departureId: id }) {
    const row = await loadDeparture(id);
    refuseIfBooked(row._count.bookings);
    return {
      entityType: 'departure',
      entityId: row.id,
      entityLabel: label(row),
      summary: `Delete the departure of “${row.trip.title}” on ${row.startDate.toISOString().slice(0, 10)}`,
      proposedChanges: { deleted: { from: false, to: true } },
      preconditions: { updatedAt: stamp(row.updatedAt) },
    };
  },
  async execute({ departureId: id }, prepared, actor) {
    const row = await loadDeparture(id);
    assertUnchanged(prepared.preconditions, { updatedAt: stamp(row.updatedAt) });
    refuseIfBooked(row._count.bookings);
    await db.departure.delete({ where: { id } });
    recordAiActivity(actor, { action: 'DELETE', entity: 'departure', entityId: row.id, entityLabel: label(row) });
    pushToSite('departure', [`/trips/${row.trip.slug}`]);
    return { entityId: row.id, entityLabel: label(row), data: { id: row.id, deleted: true } };
  },
});

function refuseIfBooked(bookings: number) {
  if (bookings > 0) {
    throw new McpToolError(
      'CONFLICT',
      `This departure has ${bookings} booking(s), so it is not deleted. Use departures_cancel.`,
    );
  }
}

export const DEPARTURE_TOOLS: ToolDefinition[] = [
  departuresList,
  departuresCreate,
  departuresUpdate,
  departuresCancel,
  departuresDelete,
];
