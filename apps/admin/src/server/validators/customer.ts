import { z } from 'zod';

/**
 * A customer.
 *
 * Everything but the name and the address is optional, because a customer row
 * is created at the moment somebody decides two enquiries are one person — and
 * at that moment the office has a name and an email address and nothing else.
 * A form that demanded a passport number to save a name would be a form nobody
 * used, and the record would go on living in somebody's notebook.
 *
 * The email is unique in the database, which is the one real constraint here:
 * it is what the office matches on, and two rows for one address defeat the
 * purpose of the table.
 */
export const customerSchema = z.object({
  name: z.string().min(1, 'A name, at least.').max(160),
  email: z.string().email('That does not look like an email address.').max(200),
  phone: z.string().max(40).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  notes: z.string().max(4_000).nullable().optional(),

  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  postalCode: z.string().max(40).nullable().optional(),
  countryCode: z.string().max(2).nullable().optional(),

  dateOfBirth: z.string().nullable().optional(),
  nationality: z.string().max(80).nullable().optional(),
  passportNumber: z.string().max(40).nullable().optional(),
  passportExpiry: z.string().nullable().optional(),

  dietary: z.string().max(500).nullable().optional(),
  emergencyContactName: z.string().max(120).nullable().optional(),
  emergencyContactPhone: z.string().max(40).nullable().optional(),

  /**
   * Recorded, never inferred.
   *
   * Somebody who booked a journey did not thereby ask for the newsletter, and
   * a box that defaults to ticked is a consent record that proves nothing.
   */
  marketingOptIn: z.boolean().default(false),
});

export const customerUpdateSchema = customerSchema.partial();

export type CustomerInput = z.infer<typeof customerSchema>;
