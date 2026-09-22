import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { bookingCreateSchema, type BookingInput } from '@/server/validators/booking';
import {
  applyCoupon,
  bookingInclude,
  date,
  nextBookingReference,
  priceItems,
  resolveDates,
  syncDepartureCapacity,
  totalsFor,
} from '@/server/services/booking';

/**
 * Bookings.
 *
 * Personal data and money, so `bookings.read` — which the Editor role does not
 * hold. Somebody who writes the journal has no business reading a passport
 * number, and this is the table those live under.
 */

/**
 * The filters the list screen sends.
 *
 * `payment` is the interesting one: it is not a column, it is a comparison
 * between two of them, and it is done in SQL rather than by filtering the page
 * in JavaScript. A page filtered after it was fetched shows eleven rows on a
 * page of twenty-five and a pager that claims there are four hundred, which is
 * the bug this comment exists to have prevented.
 */
function paymentWhere(state: string | null): Prisma.BookingWhereInput {
  switch (state) {
    case 'unpaid':
      return { netPaidCents: { lte: 0 } };
    case 'part':
      return {
        AND: [
          { netPaidCents: { gt: 0 } },
          { netPaidCents: { lt: db.booking.fields.totalCents } },
        ],
      };
    case 'paid':
      return { netPaidCents: { gte: db.booking.fields.totalCents } };
    case 'owing':
      /* What the office actually opens this screen for: money outstanding on
         something that is going to happen. */
      return {
        netPaidCents: { lt: db.booking.fields.totalCents },
        status: { in: ['PROVISIONAL', 'CONFIRMED'] },
      };
    default:
      return {};
  }
}

export const GET = route({
  permission: 'bookings.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);
    const get = (key: string) => {
      const value = searchParams.get(key);
      return value && value !== 'all' ? value : null;
    };

    const party = get('party');
    const from = date(searchParams.get('from'));
    const to = date(searchParams.get('to'));
    /* Read once into consts: `get()` returns `string | null`, and TypeScript
       cannot narrow the second call of a pair inside a conditional spread. */
    const kind = get('kind');
    const trip = get('trip');
    const departure = get('departure');
    const customer = get('customer');
    const assignee = get('assignee');

    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { reference: { contains: q.search, mode: 'insensitive' } },
              { customer: { name: { contains: q.search, mode: 'insensitive' } } },
              { customer: { email: { contains: q.search, mode: 'insensitive' } } },
              { trip: { title: { contains: q.search, mode: 'insensitive' } } },
              /* Searching a traveller's surname is how the office finds the
                 booking somebody's husband made. */
              {
                travellers: {
                  some: {
                    OR: [
                      { firstName: { contains: q.search, mode: 'insensitive' } },
                      { lastName: { contains: q.search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(q.status && q.status !== 'all' ? { status: q.status as never } : {}),
      ...(kind ? { kind: kind as never } : {}),
      ...(trip ? { tripId: trip } : {}),
      ...(departure ? { departureId: departure } : {}),
      ...(customer ? { customerId: customer } : {}),
      ...(assignee
        ? assignee === 'nobody'
          ? { assigneeId: null }
          : { assigneeId: assignee }
        : {}),
      ...paymentWhere(get('payment')),
      /* Solo and group are the party size, not a kind — see `BookingKind`. */
      ...(party === 'solo' ? { adults: 1, children: 0 } : {}),
      ...(party === 'group' ? { NOT: { adults: 1, children: 0 } } : {}),
      ...(from || to
        ? { startDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    const sortable: Record<string, Prisma.BookingOrderByWithRelationInput> = {
      createdAt: { createdAt: q.direction },
      startDate: { startDate: q.direction },
      totalCents: { totalCents: q.direction },
      reference: { reference: q.direction },
    };

    const [rows, total, counts, money] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: sortable[q.sort] ?? { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          trip: { select: { id: true, title: true } },
          customer: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true } },
          departure: { select: { id: true, startDate: true } },
          _count: { select: { travellers: true, payments: true } },
        },
      }),
      db.booking.count({ where }),
      db.booking.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: true,
      }),
      /**
       * The figures above the table.
       *
       * Summed over the whole filtered set rather than the page. "£40,000
       * outstanding" is the number somebody came here for, and a total that
       * only covers the twenty-five rows in front of them is worse than no
       * total at all — it is a number that looks like the answer.
       */
      db.booking.aggregate({
        where,
        _sum: { totalCents: true, netPaidCents: true },
      }),
    ]);

    const totalCents = money._sum.totalCents ?? 0;
    /* Already net — see the column's own comment. Subtracting the refunds
       again here is exactly the double-count the rename was made to stop. */
    const paidCents = money._sum.netPaidCents ?? 0;

    return {
      ...paginated(rows, total, q),
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
      totals: {
        totalCents,
        paidCents,
        outstandingCents: Math.max(0, totalCents - paidCents),
      },
    };
  },
});

export const POST = route<BookingInput>({
  permission: 'bookings.write',
  schema: bookingCreateSchema,
  handler: async ({ body, user, audit }) => {
    const booking = await db.$transaction(async (tx) => {
      const reference = await nextBookingReference(tx);
      const dates = await resolveDates(tx, body);
      const items = priceItems(body);

      /* Created bare, then priced. The coupon needs a booking id to hold its
         redemption against, and the redemption's existence is what stops the
         same coupon being counted twice on one booking. */
      const created = await tx.booking.create({
        data: {
          reference,
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
          confirmedAt: body.status === 'CONFIRMED' ? new Date() : null,
          cancelledAt: body.status === 'CANCELLED' ? new Date() : null,
          completedAt: body.status === 'COMPLETED' ? new Date() : null,
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
        { id: created.id, customerId: created.customerId, tripId: created.tripId },
        body.couponCode,
        provisional.subtotalCents,
      );
      const totals = totalsFor(items, coupon.discountCents);

      const priced = await tx.booking.update({
        where: { id: created.id },
        data: {
          couponId: coupon.couponId,
          couponCode: coupon.couponCode,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
        },
        include: bookingInclude,
      });

      await syncDepartureCapacity(tx, priced.departureId);

      /* The enquiry this came from is converted, not left at "quoted". The
         inbox is a list of things that still need somebody, and an enquiry
         that has become a booking does not. */
      if (priced.enquiryId) {
        await tx.enquiry.update({
          where: { id: priced.enquiryId },
          data: { status: 'CONVERTED', closedAt: new Date() },
        });
      }

      return priced;
    });

    audit({
      action: 'CREATE',
      entity: 'booking',
      entityId: booking.id,
      entityLabel: `${booking.reference} — ${booking.customer.name}`,
      after: { status: booking.status, totalCents: booking.totalCents },
    });

    void user;
    return { booking };
  },
});
