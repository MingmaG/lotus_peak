import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { paymentUpdateSchema } from '@/server/validators/payment';
import { date, recalculatePaid } from '@/server/services/booking';

type Patch = {
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  method?: 'BANK_TRANSFER' | 'CARD' | 'CASH' | 'WISE' | 'PAYPAL' | 'CHEQUE' | 'OTHER';
  kind?: 'DEPOSIT' | 'BALANCE' | 'FULL' | 'EXTRA' | 'REFUND' | 'ADJUSTMENT';
  feeCents?: number;
  providerRef?: string | null;
  paidAt?: string;
  notes?: string | null;
};

/**
 * Marking a payment cleared, or noting what the bank charged.
 *
 * The amount is not here, and neither is the booking — see the note on
 * `paymentUpdateSchema`. A cleared payment for the wrong amount is corrected
 * by cancelling it and entering the right one, so that this table and the bank
 * statement still tell the same story.
 */
export const PATCH = route<Patch, { id: string }>({
  permission: 'payments.write',
  schema: paymentUpdateSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.payment.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!before) throw notFound('That payment');

    const payment = await db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: params.id },
        data: {
          status: body.status,
          method: body.method,
          kind: body.kind,
          feeCents: body.feeCents,
          providerRef: body.providerRef === undefined ? undefined : body.providerRef || null,
          paidAt: body.paidAt ? (date(body.paidAt) ?? undefined) : undefined,
          notes: body.notes === undefined ? undefined : body.notes || null,
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

      /* A pending transfer that has landed changes what the booking has paid,
         and so does one that bounced. */
      await recalculatePaid(tx, updated.bookingId);
      return updated;
    });

    audit({
      action: 'UPDATE',
      entity: 'payment',
      entityId: payment.id,
      entityLabel: `${payment.reference} — ${payment.booking.reference}`,
      before: { status: before.status, feeCents: before.feeCents },
      after: { status: payment.status, feeCents: payment.feeCents },
    });

    return { payment };
  },
});

/**
 * Voided, not deleted.
 *
 * A ledger that can lose a row is not a ledger. The row stops counting towards
 * the booking's paid total the moment it is hidden, which is the effect
 * somebody wants when they mis-key an amount — and the row is still there when
 * the question six months later is why the total moved.
 */
export const DELETE = route<undefined, { id: string }>({
  permission: 'payments.delete',
  handler: async ({ params, audit }) => {
    const payment = await db.payment.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { booking: { select: { reference: true } } },
    });
    if (!payment) throw notFound('That payment');

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: params.id },
        data: { deletedAt: new Date() },
      });
      await recalculatePaid(tx, payment.bookingId);
    });

    audit({
      action: 'DELETE',
      entity: 'payment',
      entityId: payment.id,
      entityLabel: `${payment.reference} — ${payment.booking.reference}`,
      before: { amountCents: payment.amountCents, direction: payment.direction },
    });
    return null;
  },
});
