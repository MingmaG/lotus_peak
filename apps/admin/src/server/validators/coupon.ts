import { z } from 'zod';

/**
 * A coupon.
 *
 * `value` means two different things depending on `kind` — a percentage or a
 * number of cents — which is the one genuinely awkward thing in this file. The
 * alternative was two nullable columns, `percentage` and `amountCents`, with a
 * rule that exactly one is set; that is the same ambiguity written twice as
 * long, and it lets a row exist with both.
 *
 * The refinement below is what keeps the pair honest, and it is checked here
 * rather than only on the form because the form is not the only way in.
 */

const cents = z.number().int().min(0).max(1_000_000_00);

export const couponKindSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);

const base = z.object({
  /**
   * Upper-cased on the way in.
   *
   * Travellers type a code in whatever case they read it, and a coupon that
   * works as `SPRING26` and not as `spring26` is a support email that ends
   * with the office typing it in for them.
   */
  code: z
    .string()
    .min(3, 'A code needs at least three characters.')
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, dashes and underscores.')
    .transform((value) => value.toUpperCase()),
  description: z.string().max(300).nullable().optional(),

  kind: couponKindSchema.default('PERCENTAGE'),
  value: z.number().int().min(1, 'A discount of nothing is not a discount.'),
  currency: z.string().length(3).default('USD'),

  minSpendCents: cents.nullable().optional(),
  maxDiscountCents: cents.nullable().optional(),

  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),

  maxRedemptions: z.number().int().min(1).max(100_000).nullable().optional(),
  maxPerCustomer: z.number().int().min(1).max(1_000).nullable().optional(),

  /** Empty means every journey. */
  tripIds: z.array(z.string()).max(100).default([]),

  isActive: z.boolean().default(true),
});

function rules<T extends typeof base>(schema: T) {
  return schema.superRefine((value: z.infer<typeof base>, context) => {
    if (value.kind === 'PERCENTAGE' && value.value > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'A percentage cannot be more than 100.',
      });
    }

    /* A cap on a fixed amount is the cap applied twice, and the two figures
       will eventually disagree. */
    if (value.kind === 'FIXED_AMOUNT' && value.maxDiscountCents != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxDiscountCents'],
        message: 'A fixed amount is already its own maximum.',
      });
    }

    if (value.startsAt && value.endsAt && new Date(value.endsAt) < new Date(value.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsAt'],
        message: 'It has to end after it starts.',
      });
    }
  });
}

export const couponCreateSchema = rules(base);
export const couponUpdateSchema = rules(base);

export type CouponInput = z.infer<typeof base>;

/**
 * Trying a code against a booking that is still being typed.
 *
 * The booking may not exist yet — the office applies a code while building the
 * quote — so this takes a subtotal and a journey rather than a booking id.
 */
export const couponTrySchema = z.object({
  code: z.string().min(1, 'Type a code.').max(40),
  subtotalCents: cents,
  tripId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  /** Excluded from the redemption count, so re-saving a booking is not a use. */
  bookingId: z.string().nullable().optional(),
});
