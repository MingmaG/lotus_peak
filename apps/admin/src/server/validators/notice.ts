import { z } from 'zod';

/**
 * Announcements and banners.
 *
 * The two share their scheduling, their page targeting and their links, so
 * those rules live here once. A banner whose `/trips/*` matched and an
 * announcement whose `/trips/*` did not would be two rules for one sentence on
 * the screen.
 */

/**
 * A link the website will draw.
 *
 * The same four forms the website's sanitiser accepts — a path, a fragment,
 * http(s), mailto and tel — refused here so the office hears about a typo on
 * Save rather than finding a link that silently did not render.
 */
const href = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value === '' ||
      (value.startsWith('/') && !value.startsWith('//')) ||
      value.startsWith('#') ||
      /^(https?:\/\/|mailto:|tel:)/i.test(value),
    'A path like /trips/jomolhari, or a full address starting https://.',
  )
  .nullable()
  .optional()
  .transform((value) => value || null);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

/** `/trips`, `/trips/*` or `/`. No query strings, no hosts. */
const pathPattern = z
  .string()
  .trim()
  .regex(/^\/[a-z0-9\-/]*(\/\*)?$/i, 'A path such as /trips or /trips/* — starting with a slash.');

const when = z
  .string()
  .datetime({ offset: true, message: 'That is not a date and time.' })
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));

const schedule = {
  showOn: z.array(pathPattern).max(50).default([]),
  hideOn: z.array(pathPattern).max(50).default([]),
  isActive: z.boolean().default(false),
  startsAt: when,
  endsAt: when,
  sortOrder: z.number().int().min(0).optional(),
};

/** An expiry before the start is a notice that never runs, which is never meant. */
function endsAfterStart(value: { startsAt?: Date | null; endsAt?: Date | null }) {
  return !value.startsAt || !value.endsAt || value.endsAt > value.startsAt;
}
const ENDS_AFTER_START = { message: 'It has to end after it starts.', path: ['endsAt'] };

const announcementFields = z.object({
  name: z.string().trim().max(120).default(''),
  label: optionalText(30),
  message: z.string().min(1, 'What should it say?').max(4_000),
  href,
  linkLabel: optionalText(60),
  tone: z.enum(['GENERAL', 'OFFER', 'ADVISORY', 'FESTIVAL']).default('GENERAL'),
  dismissible: z.boolean().default(true),
  ...schedule,
});

export const announcementSchema = announcementFields.refine(endsAfterStart, ENDS_AFTER_START);
export const announcementPatchSchema = announcementFields
  .partial()
  .refine(endsAfterStart, ENDS_AFTER_START);

const bannerFields = z.object({
  name: z.string().trim().max(120).default(''),
  placement: z.enum(['PAGE_END', 'POPUP']).default('PAGE_END'),
  layout: z.enum(['IMAGE_LEFT', 'IMAGE_RIGHT', 'BACKDROP']).default('IMAGE_RIGHT'),
  theme: z.enum(['PAPER', 'MIST', 'INK']).default('MIST'),
  eyebrow: optionalText(60),
  heading: z.string().trim().min(1, 'A banner needs a heading.').max(140),
  body: z.string().max(8_000).default(''),
  imageId: z.string().nullable().optional(),
  href,
  linkLabel: optionalText(40),
  secondaryHref: href,
  secondaryLabel: optionalText(40),
  ...schedule,
});

export const bannerSchema = bannerFields.refine(endsAfterStart, ENDS_AFTER_START);
export const bannerPatchSchema = bannerFields.partial().refine(endsAfterStart, ENDS_AFTER_START);

export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
