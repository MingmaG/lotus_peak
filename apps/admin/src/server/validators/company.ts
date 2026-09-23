import { z } from 'zod';

/**
 * The company, once.
 *
 * Everything the footer, the contact page, the enquiry email, the structured
 * data and the WhatsApp link would otherwise each hold a copy of. One screen
 * writes all of it, and the validation here is what keeps the copies honest —
 * a telephone number with a space in `value` is a `tel:` link that does not
 * dial, and a social URL that is not a URL is a `sameAs` entry that tells a
 * search engine this company is something it is not.
 */

export const socialPlatforms = [
  'INSTAGRAM',
  'FACEBOOK',
  'YOUTUBE',
  'X',
  'TIKTOK',
  'LINKEDIN',
  'PINTEREST',
  'TRIPADVISOR',
  'WHATSAPP',
  'THREADS',
  'OTHER',
] as const;

export const contactKinds = ['PHONE', 'MOBILE', 'WHATSAPP', 'EMAIL', 'FAX'] as const;

const contactSchema = z
  .object({
    kind: z.enum(contactKinds),
    label: z.string().min(1, 'Give it a label.').max(60),
    /** The machine form: `+97517984485`, or an address. */
    value: z.string().min(1, 'This cannot be empty.').max(200),
    /** What a person reads: `+975 17984485`. */
    display: z.string().min(1, 'This cannot be empty.').max(200),
    isPrimary: z.boolean().default(false),
    isPublic: z.boolean().default(true),
    prefillMessage: z.string().max(500).nullable().optional(),
  })
  .superRefine((contact, ctx) => {
    if (contact.kind === 'EMAIL') {
      if (!z.string().email().safeParse(contact.value).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'That does not look like an email address.',
        });
      }
      return;
    }

    /**
     * A number the browser can dial.
     *
     * `tel:` ignores spaces, but WhatsApp's `wa.me` path does not — it takes
     * digits only — and both read this column. Insisting on the strict form
     * here, with the readable form beside it in `display`, is what lets one
     * row serve both.
     */
    if (!/^\+?[0-9]{6,15}$/.test(contact.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message:
          'Digits only, with an optional leading +. The version with spaces goes in the field beside it.',
      });
    }
  });

const socialSchema = z.object({
  platform: z.enum(socialPlatforms),
  label: z.string().min(1, 'Give it a name.').max(80),
  handle: z.string().max(120).nullable().optional(),
  url: z.string().url('That is not a web address.').max(500),
  isActive: z.boolean().default(true),
});

const hoursSchema = z
  .object({
    dayFrom: z.number().int().min(1).max(7),
    dayTo: z.number().int().min(1).max(7),
    opens: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    closes: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    closed: z.boolean().default(false),
    note: z.string().max(200).nullable().optional(),
  })
  .refine((row) => row.dayFrom <= row.dayTo, {
    message: 'The first day has to come before the last.',
    path: ['dayTo'],
  })
  .refine((row) => row.closed || (row.opens && row.closes), {
    message: 'Give an opening and a closing time, or mark the day closed.',
    path: ['opens'],
  });

export const companySchema = z.object({
  legalName: z.string().min(1, 'The registered name cannot be empty.').max(200),
  name: z.string().min(1, 'The name the site uses cannot be empty.').max(120),
  tagline: z.string().max(200).default(''),
  description: z.string().max(2_000).default(''),
  foundedYear: z.number().int().min(1900).max(2100).nullable().optional(),
  licenceNumber: z.string().max(80).nullable().optional(),
  registrationNumber: z.string().max(80).nullable().optional(),
  logoId: z.string().nullable().optional(),
  markId: z.string().nullable().optional(),

  strapline: z.string().max(200).default(''),
  footerNote: z.string().max(300).default(''),
  footerCopyright: z.string().max(200).default('© {year} {name}'),
  footerCreditLabel: z.string().max(60).default(''),
  footerCreditName: z.string().max(80).default(''),
  footerCreditUrl: z.string().url('That is not a web address.').max(300).or(z.literal('')).default(''),
  footerShowLinks: z.boolean().default(true),
  footerShowAddress: z.boolean().default(true),
  footerShowContacts: z.boolean().default(true),
  footerShowSocials: z.boolean().default(true),
  replyPromise: z.string().max(200).default(''),

  pledgePercent: z.number().int().min(0).max(100).nullable().optional(),
  pledgeBeneficiary: z.string().max(200).nullable().optional(),
  pledgeNote: z.string().max(600).nullable().optional(),
  sdfPerNightUsd: z.number().int().min(0).max(10_000).default(100),

  siteUrl: z.string().url('That is not a web address.').max(300),
  seoTitleTemplate: z.string().max(120).default('%s · Lotus Peak'),
  seoDefaultTitle: z.string().max(120).default('Lotus Peak'),
  seoDescription: z.string().max(400).default(''),
  ogImageId: z.string().nullable().optional(),

  address: z.object({
    line1: z.string().min(1, 'The line the footer prints cannot be empty.').max(200),
    line2: z.string().max(200).nullable().optional(),
    /**
     * The city on its own.
     *
     * Separate from `line1` because two audiences read them differently:
     * `line1` is what the footer prints — "Norzin Lam, Thimphu" — and this is
     * `addressLocality` in the structured data. A search engine told the
     * locality is "Norzin Lam" places the company in a street.
     */
    locality: z.string().min(1, 'The town or city cannot be empty.').max(120),
    region: z.string().max(120).nullable().optional(),
    postalCode: z.string().max(20).nullable().optional(),
    country: z.string().min(1).max(80).default('Bhutan'),
    countryCode: z.string().length(2, 'Two letters, like BT.').default('BT'),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    mapUrl: z.string().url().max(500).nullable().optional().or(z.literal('')),
  }),

  contacts: z.array(contactSchema).max(20).default([]),
  socials: z.array(socialSchema).max(20).default([]),
  officeHours: z.array(hoursSchema).max(10).default([]),

  announcement: z
    .object({
      message: z.string().max(300),
      href: z.string().max(500).nullable().optional(),
      linkLabel: z.string().max(60).nullable().optional(),
      isActive: z.boolean().default(false),
    })
    .nullable()
    .optional(),

  integrations: z
    .object({
      googleAnalyticsId: z.string().max(60).nullable().optional(),
      googleTagManagerId: z.string().max(60).nullable().optional(),
      googleSiteVerification: z.string().max(200).nullable().optional(),
      metaPixelId: z.string().max(60).nullable().optional(),
      tripadvisorWidgetId: z.string().max(60).nullable().optional(),
    })
    .optional(),
});

export type CompanyInput = z.infer<typeof companySchema>;
