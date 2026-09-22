import { z } from 'zod';

/**
 * A booking, as the Bookings screen sends it.
 *
 * Two things this file refuses to accept from the client, and they are the
 * whole reason it is longer than a list of fields:
 *
 *   * **Any total.** `subtotalCents`, `discountCents` and `totalCents` are not
 *     in this schema at all. They are computed in `services/booking.ts` from
 *     the lines and the coupon, inside the transaction that writes them. A
 *     client that sends its own arithmetic is a client that can be told to
 *     send different arithmetic, and the browser is not where an invoice is
 *     decided.
 *   * **`netPaidCents`.** What has been paid is the sum of the payments. There is
 *     no field on a booking form that could honestly set it.
 *
 * Money arrives as minor units — integers of cents — because the form works in
 * them throughout. A number with a decimal point crossing this wire is a
 * rounding decision made by whichever side happened to parse it.
 */

const cents = z
  .number()
  .int('Amounts are in cents, so they are whole numbers.')
  .min(0)
  .max(1_000_000_00);

export const bookingKindSchema = z.enum(['FIXED_DEPARTURE', 'PRIVATE', 'CUSTOM']);
export const bookingStatusSchema = z.enum([
  'DRAFT',
  'PROVISIONAL',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]);

/**
 * One line on the bill.
 *
 * `amountCents` is absent on purpose — see the file note. The server multiplies
 * `quantity` by `unitPriceCents` and stores the result.
 */
export const bookingItemSchema = z.object({
  id: z.string().optional(),
  kind: z
    .enum(['JOURNEY', 'SUPPLEMENT', 'EXTRA', 'PERMIT', 'FEE', 'DISCOUNT', 'OTHER'])
    .default('EXTRA'),
  label: z.string().min(1, 'What is this line for?').max(160),
  detail: z.string().max(500).nullable().optional(),
  quantity: z.number().int().min(1, 'At least one.').max(200).default(1),
  unitPriceCents: cents.default(0),
});

/**
 * One person travelling.
 *
 * Almost every field is optional, and that is the point rather than laziness.
 * A booking is taken on the telephone with two names and a deposit, and the
 * passport numbers arrive six weeks later. A form that demanded them at the
 * start would be a form the office worked around by typing `TBC` into it,
 * which is worse than an empty column — an empty column can be counted.
 */
export const bookingTravellerSchema = z.object({
  id: z.string().optional(),
  isLead: z.boolean().default(false),
  firstName: z.string().min(1, 'A first name, at least.').max(80),
  lastName: z.string().max(80).default(''),
  email: z
    .string()
    .email('That does not look like an email address.')
    .max(200)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  phone: z.string().max(40).nullable().optional(),
  /** A date, not a datetime: a birthday has no o'clock and no timezone. */
  dateOfBirth: z.string().nullable().optional(),
  nationality: z.string().max(80).nullable().optional(),
  passportName: z.string().max(160).nullable().optional(),
  passportNumber: z.string().max(40).nullable().optional(),
  passportExpiry: z.string().nullable().optional(),
  passportCountry: z.string().max(80).nullable().optional(),
  dietary: z.string().max(500).nullable().optional(),
  medical: z.string().max(1_000).nullable().optional(),
  emergencyContactName: z.string().max(120).nullable().optional(),
  emergencyContactPhone: z.string().max(40).nullable().optional(),
  roomPreference: z.string().max(160).nullable().optional(),
  notes: z.string().max(1_000).nullable().optional(),
  customerId: z.string().nullable().optional(),
});

const base = z.object({
  kind: bookingKindSchema,
  status: bookingStatusSchema.default('DRAFT'),

  tripId: z.string().nullable().optional(),
  departureId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),

  customerId: z.string().min(1, 'Who is this booking for?'),
  enquiryId: z.string().nullable().optional(),

  adults: z.number().int().min(1, 'At least one adult.').max(60).default(1),
  children: z.number().int().min(0).max(60).default(0),

  currency: z.string().length(3).default('USD'),
  pricePerPersonCents: cents.default(0),

  /**
   * The bill, whole.
   *
   * Sent as a complete list and replaced as one, rather than patched line by
   * line. A booking's lines are edited together — the office adds the single
   * supplement and drops the extra night in the same breath — and a per-line
   * endpoint means a total that is briefly wrong between two requests, on the
   * screen somebody is reading it from.
   */
  items: z.array(bookingItemSchema).max(60).default([]),
  travellers: z.array(bookingTravellerSchema).max(60).default([]),

  /** Uppercased and checked in the service; an unknown code is a 422. */
  couponCode: z.string().max(40).nullable().optional(),

  depositDueCents: cents.nullable().optional(),
  depositDueAt: z.string().nullable().optional(),
  balanceDueAt: z.string().nullable().optional(),

  source: z
    .enum([
      'CONTACT',
      'TRIP_DETAIL',
      'DRAWER',
      'NEWSLETTER',
      'PHONE',
      'WHATSAPP',
      'EMAIL',
      'WALK_IN',
    ])
    .nullable()
    .optional(),
  assigneeId: z.string().nullable().optional(),

  requests: z.string().max(4_000).nullable().optional(),
  internalNotes: z.string().max(4_000).nullable().optional(),
  cancellationReason: z.string().max(500).nullable().optional(),
});

/**
 * The rules that need two fields to check.
 *
 * Written as refinements on the whole object rather than as prose in a comment
 * on the screen, because the screen is not the only way in — the API is, and a
 * rule enforced only by a disabled button is not enforced.
 */
function crossFieldRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .superRefine((value: z.infer<typeof base>, context) => {
      if (value.kind === 'FIXED_DEPARTURE' && !value.departureId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['departureId'],
          message: 'A fixed-departure booking needs the departure it is on.',
        });
      }

      /* A private booking has no departure to take its dates from, so it has
         to carry its own — otherwise the confirmation goes out saying when
         nothing. */
      if (value.kind !== 'FIXED_DEPARTURE' && value.status !== 'DRAFT' && !value.startDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'Once it is more than a draft, it needs dates.',
        });
      }

      if (
        value.startDate &&
        value.endDate &&
        new Date(value.endDate) < new Date(value.startDate)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'It has to end after it starts.',
        });
      }

      /* One lead, not two. The confirmation is addressed to them and the
         permit application names them first; two leads means whichever the
         sort happened to put first, which is not a decision to leave to a
         sort. */
      const leads = value.travellers.filter((one) => one.isLead).length;
      if (leads > 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['travellers'],
          message: 'Only one traveller can be the lead.',
        });
      }

      if (value.travellers.length > value.adults + value.children) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['travellers'],
          message: `The party is ${value.adults + value.children}, and there are ${value.travellers.length} travellers named.`,
        });
      }

      if (value.status === 'CANCELLED' && !value.cancellationReason?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cancellationReason'],
          /* A cancelled booking with no reason is a row somebody has to
             telephone about six months later, when nobody remembers. */
          message: 'Say why it was cancelled.',
        });
      }
    });
}

export const bookingCreateSchema = crossFieldRules(base);
export const bookingUpdateSchema = crossFieldRules(base);

export type BookingInput = z.infer<typeof base>;

/** Adding a note, which is the commonest write on the detail screen. */
export const bookingNoteSchema = z.object({
  body: z.string().min(1, 'Write something.').max(4_000),
});
