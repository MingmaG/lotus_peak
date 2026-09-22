import { z } from 'zod';

/**
 * A payment, as the office records it.
 *
 * Every row on this table is entered by a person who has seen the money —
 * there is no provider webhook writing here, and this schema does not pretend
 * one might. `providerRef` is the bank's reference off the statement, which is
 * what reconciling actually needs.
 *
 * `amountCents` is always positive. A refund is `direction: 'OUT'`, not a
 * negative number; see the note on `PaymentDirection` in the schema for why a
 * signed amount is a sum waiting to be got wrong.
 */

const cents = z
  .number()
  .int('Amounts are in cents, so they are whole numbers.')
  .min(0)
  .max(1_000_000_00);

export const paymentDirectionSchema = z.enum(['IN', 'OUT']);
export const paymentKindSchema = z.enum([
  'DEPOSIT',
  'BALANCE',
  'FULL',
  'EXTRA',
  'REFUND',
  'ADJUSTMENT',
]);
export const paymentStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']);
export const paymentMethodSchema = z.enum([
  'BANK_TRANSFER',
  'CARD',
  'CASH',
  'WISE',
  'PAYPAL',
  'CHEQUE',
  'OTHER',
]);

const base = z.object({
  bookingId: z.string().min(1, 'Which booking is this against?'),
  direction: paymentDirectionSchema.default('IN'),
  kind: paymentKindSchema.default('DEPOSIT'),
  /**
   * Defaults to `COMPLETED` rather than `PENDING`.
   *
   * The commonest reason somebody opens this form is that the money has
   * arrived, and a default of pending means the frequent case needs an extra
   * decision while the rare one needs none.
   */
  status: paymentStatusSchema.default('COMPLETED'),
  method: paymentMethodSchema.default('BANK_TRANSFER'),

  amountCents: cents.refine((value) => value > 0, 'An amount of nothing is not a payment.'),
  currency: z.string().length(3).default('USD'),
  feeCents: cents.default(0),

  providerRef: z.string().max(120).nullable().optional(),
  paidAt: z.string(),
  notes: z.string().max(1_000).nullable().optional(),
});

export const paymentCreateSchema = base.superRefine((value, context) => {
  /* A refund that is not marked as one, or a `REFUND` going the wrong way,
     both produce a booking whose paid total is wrong in the direction nobody
     checks. The two fields have to agree. */
  if (value.kind === 'REFUND' && value.direction !== 'OUT') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['direction'],
      message: 'A refund goes out.',
    });
  }
  if (value.direction === 'OUT' && value.kind !== 'REFUND' && value.kind !== 'ADJUSTMENT') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['kind'],
      message: 'Money going out is a refund or an adjustment.',
    });
  }
});

/**
 * What may be changed after the fact.
 *
 * Not the amount and not the booking. A payment that has cleared for the wrong
 * amount is corrected by cancelling it and entering the right one, so that the
 * statement and this table still tell the same story — editing the figure in
 * place leaves a ledger that agrees with nothing.
 */
export const paymentUpdateSchema = z.object({
  status: paymentStatusSchema.optional(),
  method: paymentMethodSchema.optional(),
  kind: paymentKindSchema.optional(),
  feeCents: cents.optional(),
  providerRef: z.string().max(120).nullable().optional(),
  paidAt: z.string().optional(),
  notes: z.string().max(1_000).nullable().optional(),
});

export type PaymentInput = z.infer<typeof base>;
