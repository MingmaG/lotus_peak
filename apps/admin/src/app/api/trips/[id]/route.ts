import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { diff } from '@/server/services/activity';
import { problemsPublishingTrip } from '@/server/services/publish';
import { revalidateFor } from '@/server/services/revalidate';
import { TRIP_DETAIL_INCLUDE, restoreTrip, softDeleteTrip, updateTrip } from '@/server/services/trip';
import { tripPatchSchema, type TripPatch } from '@/server/validators/trip';

export const GET = route<undefined, { id: string }>({
  permission: 'trips.read',
  handler: async ({ params }) => {
    const trip = await db.trip.findUnique({
      where: { id: params.id },
      include: TRIP_DETAIL_INCLUDE,
    });
    if (!trip) throw notFound('That journey');
    return { trip };
  },
});

export const PATCH = route<TripPatch, { id: string }>({
  permission: 'trips.write',
  schema: tripPatchSchema,
  handler: async ({ params, body, user, audit }) => {
    const before = await db.trip.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That journey');

    /**
     * Publishing is a separate permission, and it is checked here rather than
     * on the route.
     *
     * The route needs `trips.write`, because the same endpoint saves a draft.
     * An Editor may publish; a Reservations login may not, and without this
     * they could publish by sending `status` with an otherwise ordinary save.
     */
    if (body.status === 'PUBLISHED' && before.status !== 'PUBLISHED') {
      if (!user.permissions.includes('*') && !user.permissions.includes('trips.publish')) {
        throw new ApiError(403, 'FORBIDDEN', 'This account can edit journeys but not publish them.');
      }

      const problems = await problemsPublishingTrip(params.id);
      if (problems.length > 0) {
        throw new ApiError(
          422,
          'NOT_READY',
          'This journey is not ready to be published.',
          Object.fromEntries(problems.map((problem) => [problem.field, problem.message])),
        );
      }
    }

    const trip = await updateTrip(params.id, body);
    const changes = diff(before as never, trip as never);

    audit({
      action: body.status && body.status !== before.status
        ? body.status === 'PUBLISHED'
          ? 'PUBLISH'
          : before.status === 'PUBLISHED'
            ? 'UNPUBLISH'
            : 'UPDATE'
        : 'UPDATE',
      entity: 'trip',
      entityId: trip.id,
      entityLabel: trip.title,
      before: changes.before as never,
      after: changes.after as never,
    });

    /**
     * The old path is revalidated as well as the new one.
     *
     * A slug that moved leaves a prerendered page at the old URL that would
     * keep serving until its hour was up — and the redirect that now covers it
     * cannot be seen by a cache entry that already exists.
     */
    const paths = [`/trips/${trip.slug}`];
    if (before.slug !== trip.slug) paths.push(`/trips/${before.slug}`);

    const push = await revalidateFor('trip', paths);

    return { trip, revalidated: push };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'trips.delete',
  handler: async ({ params, searchParams, audit }) => {
    const trip = await db.trip.findUnique({ where: { id: params.id } });
    if (!trip) throw notFound('That journey');

    if (searchParams.get('restore') === '1') {
      const restored = await restoreTrip(params.id);
      audit({
        action: 'RESTORE',
        entity: 'trip',
        entityId: restored.id,
        entityLabel: restored.title,
      });
      return { trip: restored };
    }

    await softDeleteTrip(params.id);
    audit({ action: 'DELETE', entity: 'trip', entityId: trip.id, entityLabel: trip.title });
    void revalidateFor('trip', [`/trips/${trip.slug}`]);
    return null;
  },
});
