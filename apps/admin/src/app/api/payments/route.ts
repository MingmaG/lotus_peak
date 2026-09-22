import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, notFound, paginated, route } from '@/lib/api/handler';
import { paymentReference } from '@/lib/reference';
import { paymentCreateSchema, type PaymentInput } from '@/server/validators/payment';
import { date, recalculatePaid } from '@/server/services/booking';

/**
 * Every transaction, across every booking.
 *
 * This is the ledger rather than a booking's payments — the same rows, read
 * the other way round. The office opens it to reconcile a bank statement,
 * which means the question is "what arrived in March", not "what has LP-B-7QK4
 * paid". The booking's own screen answers the second.
 */

export const GET = route({
  permission: 'payments.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);
    const get = (key: string) => {
      const value = searchParams.get(key);
      return value && value !== 'all' ? value : null;
    };

    const from = date(searchParams.get('from'));
    const to = date(searchParams.get('to'));
    /* Read once — see the same note on the bookings list. */
    const method = get('method');
    const kind = get('kind');
    const direction = get('direction');
    const booking = get('booking');

    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { reference: { contains: q.search, mode: 'insensitive' } },
              { providerRef: { contains: q.search, mode: 'insensitive' } },
              { booking: { reference: { contains: q.search, mode: 'insensitive' } } },
              {
                booking: {
                  customer: { name: { contains: q.search, mode: 'insensitive' } },
                },
              },
              {
                booking: {
                  customer: { email: { contains: q.search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
      ...(q.status && q.status !== 'all' ? { status: q.status as never } : {}),
      ...(method ? { method: method as never } : {}),
      ...(kind ? { kind: kind as never } : {}),
      ...(direction ? { direction: direction as never } : {}),
      ...(booking ? { bookingId: booking } : {}),
      ...(from || to
        ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };

    const sortable: Record<string, Prisma.PaymentOrderByWithRelationInput> = {
      paidAt: { paidAt: q.direction },
      amountCents: { amountCents: q.direction },
      createdAt: { createdAt: q.direction },
    };

    const [rows, total, sums, pending] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: sortable[q.sort] ?? { paidAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              currency: true,
              customer: { select: { id: true, name: true } },
              trip: { select: { id: true, title: true } },
            },
          },
          recordedBy: { select: { id: true, name: true } },
        },
      }),
      db.payment.count({ where }),
      /**
       * In and out, over the filtered set rather than the page.
       *
       * Grouped by direction and added up here rather than summed as a signed
       * column, because the amounts are unsigned by design — see
       * `PaymentDirection` in the schema.
       */
      db.payment.groupBy({
        by: ['direction'],
        where: { ...where, status: 'COMPLETED' },
        _sum: { amountCents: true, feeCents: true },
      }),
      db.payment.aggregate({
        where: { ...where, status: 'PENDING' },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);

    const received = sums.find((row) => row.direction === 'IN')?._sum.amountCents ?? 0;
    const refunded = sums.find((row) => row.direction === 'OUT')?._sum.amountCents ?? 0;
    const fees = sums.reduce((sum, row) => sum + (row._sum.feeCents ?? 0), 0);

    return {
      ...paginated(rows, total, q),
      totals: {
        receivedCents: received,
        refundedCents: refunded,
        netCents: received - refunded,
        feesCents: fees,
        pendingCents: pending._sum.amountCents ?? 0,
        pendingCount: pending._count,
      },
    };
  },
});

export const POST = route<PaymentInput>({
  permission: 'payments.write',
  schema: paymentCreateSchema,
  handler: async ({ body, user, audit }) => {
    const payment = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: body.bookingId, deletedAt: null },
        select: { id: true, reference: true, currency: true },
      });
      if (!booking) throw notFound('That booking');

      const created = await tx.payment.create({
        data: {
          reference: paymentReference(),
          bookingId: booking.id,
          direction: body.direction,
          kind: body.kind,
          status: body.status,
          method: body.method,
          amountCents: body.amountCents,
          /* The booking's currency unless the form said otherwise: a refund
             issued in a second currency happens, and defaulting to USD on a
             booking quoted in something else would be silently wrong. */
          currency: body.currency || booking.currency,
          feeCents: body.feeCents,
          providerRef: body.providerRef || null,
          paidAt: date(body.paidAt) ?? new Date(),
          notes: body.notes || null,
          recordedById: user.id,
        },
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              customer: { select: { id: true, name: true } },
            },
          },
          recordedBy: { select: { id: true, name: true } },
        },
      });

      /* The booking's paid total is a column, so it moves here — in the same
         transaction, or the two disagree for as long as it takes to notice. */
      await recalculatePaid(tx, booking.id);

      return created;
    });

    audit({
      action: 'CREATE',
      entity: 'payment',
      entityId: payment.id,
      entityLabel: `${payment.reference} — ${payment.booking.reference}`,
      after: {
        amountCents: payment.amountCents,
        direction: payment.direction,
        status: payment.status,
      },
    });

    return { payment };
  },
});
