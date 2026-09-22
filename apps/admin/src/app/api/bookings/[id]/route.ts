import { db } from '@/lib/db';
import { conflict, notFound, route } from '@/lib/api/handler';
import { bookingUpdateSchema, type BookingInput } from '@/server/validators/booking';
import {
  applyCoupon,
  bookingInclude,
  date,
  priceItems,
  resolveDates,
  syncDepartureCapacity,
  totalsFor,
} from '@/server/services/booking';

export const GET = route<undefined, { id: string }>({
  permission: 'bookings.read',
  handler: async ({ params }) => {
    const booking = await db.booking.findFirst({
      where: { id: params.id, deletedAt: null },
      include: bookingInclude,
    });
    if (!booking) throw notFound('That booking');
    return { booking };
  },
});

/**
 * A whole booking, saved at once.
 *
 * The lines and the travellers are replaced rather than patched — deleted and
 * re-created inside the transaction. Two reasons, and the second is the one
 * that matters:
 *
 *   * The form edits them as a list. Somebody adds the single supplement and
 *     removes the extra night in one sitting, and a per-row endpoint makes
 *     that two requests with a wrong total visible between them.
 *   * A diff against what is in the database would have to match rows by id,
 *     and the ids of rows the form created client-side do not exist yet. Every
 *     scheme for reconciling that is a scheme with a case that drops a
 *     traveller.
 *
 * Replacing costs the rows their `createdAt`, which nothing reads. It does not
 * cost the booking its audit trail: that is the activity log, and it is
 * written from the booking's own before-and-after below.
 */
export const PATCH = route<BookingInput, { id: string }>({
  permission: 'bookings.write',
  schema: bookingUpdateSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.booking.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!before) throw notFound('That booking');

    const booking = await db.$transaction(async (tx) => {
      const dates = await resolveDates(tx, body);
      const items = priceItems(body);

      await tx.bookingItem.deleteMany({ where: { bookingId: params.id } });
      await tx.bookingTraveller.deleteMany({ where: { bookingId: params.id } });

      await tx.booking.update({
        where: { id: params.id },
        data: {
          kind: body.kind,
          status: body.status,
          tripId: body.tripId || null,
          /* `resolveDates` is the only authority on this: it returns the
             departure for a fixed booking and null for every other kind, so
             that changing the kind away from fixed actually releases the seat.
             A `?? body.departureId` here would quietly undo that. */
          departureId: dates.departureId,
          startDate: dates.startDate,
          endDate: dates.endDate,
          customerId: body.customerId,
          enquiryId: body.enquiryId || null,
          adults: body.adults,
          children: body.children,
          currency: body.currency,
          pricePerPersonCents: body.pricePerPersonCents,
          depositDueCents: body.depositDueCents ?? null,
          depositDueAt: date(body.depositDueAt),
          balanceDueAt: date(body.balanceDueAt),
          source: body.source ?? null,
          assigneeId: body.assigneeId || null,
          requests: body.requests || null,
          internalNotes: body.internalNotes || null,
          cancellationReason: body.cancellationReason || null,

          /**
           * When each of these happened, recorded the first time it did.
           *
           * `?? new Date()` and not `new Date()`: a booking confirmed in March
           * and edited in July was confirmed in March, and a timestamp that
           * moves on every save is a timestamp that answers no question.
           */
          confirmedAt:
            body.status === 'CONFIRMED' ? (before.confirmedAt ?? new Date()) : before.confirmedAt,
          cancelledAt:
            body.status === 'CANCELLED' ? (before.cancelledAt ?? new Date()) : null,
          completedAt:
            body.status === 'COMPLETED' ? (before.completedAt ?? new Date()) : before.completedAt,

          items: { create: items },
          travellers: {
            create: body.travellers.map((one, index) => ({
              isLead: one.isLead,
              firstName: one.firstName,
              lastName: one.lastName,
              email: one.email || null,
              phone: one.phone || null,
              dateOfBirth: date(one.dateOfBirth),
              nationality: one.nationality || null,
              passportName: one.passportName || null,
              passportNumber: one.passportNumber || null,
              passportExpiry: date(one.passportExpiry),
              passportCountry: one.passportCountry || null,
              dietary: one.dietary || null,
              medical: one.medical || null,
              emergencyContactName: one.emergencyContactName || null,
              emergencyContactPhone: one.emergencyContactPhone || null,
              roomPreference: one.roomPreference || null,
              notes: one.notes || null,
              customerId: one.customerId || null,
              sortOrder: index,
            })),
          },
        },
      });

      const provisional = totalsFor(items, 0);
      const coupon = await applyCoupon(
        tx,
        { id: params.id, customerId: body.customerId, tripId: body.tripId || null },
        body.couponCode,
        provisional.subtotalCents,
      );
      const totals = totalsFor(items, coupon.discountCents);

      const saved = await tx.booking.update({
        where: { id: params.id },
        data: {
          couponId: coupon.couponId,
          couponCode: coupon.couponCode,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
        },
        include: bookingInclude,
      });

      /* Both departures, not just the new one. A booking moved off the April
         date leaves a place behind it, and a capacity that only ever goes down
         is a departure that reads full for ever. */
      await syncDepartureCapacity(tx, before.departureId);
      if (saved.departureId !== before.departureId) {
        await syncDepartureCapacity(tx, saved.departureId);
      }

      return saved;
    });

    audit({
      action: 'UPDATE',
      entity: 'booking',
      entityId: booking.id,
      entityLabel: `${booking.reference} — ${booking.customer.name}`,
      before: {
        status: before.status,
        totalCents: before.totalCents,
        adults: before.adults,
        children: before.children,
      },
      after: {
        status: booking.status,
        totalCents: booking.totalCents,
        adults: booking.adults,
        children: booking.children,
      },
    });

    return { booking };
  },
});

/**
 * Hidden, not destroyed.
 *
 * A booking has payments against it and somebody's passport number in it. A
 * real delete is the right answer to an erasure request and the wrong answer
 * to a mis-click, and the two are told apart by a person rather than by a
 * button.
 *
 * A booking with money against it is refused outright. Cancelling it is the
 * operation somebody actually wants, and it keeps the payments answerable —
 * "where did that $2,000 go" is a question a hidden booking cannot answer.
 */
export const DELETE = route<undefined, { id: string }>({
  permission: 'bookings.delete',
  handler: async ({ params, audit }) => {
    const booking = await db.booking.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { _count: { select: { payments: true } } },
    });
    if (!booking) throw notFound('That booking');

    if (booking._count.payments > 0) {
      throw conflict(
        'There are payments against this booking. Cancel it instead, so the money stays accounted for.',
      );
    }

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: params.id },
        data: { deletedAt: new Date() },
      });
      /* It was holding places on a departure until a moment ago. */
      await syncDepartureCapacity(tx, booking.departureId);
    });

    audit({
      action: 'DELETE',
      entity: 'booking',
      entityId: booking.id,
      entityLabel: booking.reference,
    });
    return null;
  },
});
