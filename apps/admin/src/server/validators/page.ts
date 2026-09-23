import { z } from 'zod';

import { storedPageSectionSchema } from '@/server/schema/blocks';
import { seoSchema, statusSchema } from './trip';

/**
 * An editorial page.
 *
 * `sections` is a closed union, validated by the same schema that guards the
 * column. A free block builder would let an editor compose a page the design
 * has no styles for; ten section types is a vocabulary, and a vocabulary is
 * what makes a page somebody else wrote recognisable.
 */
export const pageSchema = z.object({
  title: z.string().min(1, 'Give the page a title.').max(200),
  slug: z.string().max(140).optional(),
  path: z
    .string()
    .max(200)
    .optional()
    .refine((value) => value === undefined || value.startsWith('/'), 'It has to start with a /.'),
  eyebrow: z.string().max(80).nullable().optional(),
  lead: z.string().max(800).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
  sections: z.array(storedPageSectionSchema).max(60).default([]),
  heroId: z.string().nullable().optional(),
  tripIds: z.array(z.string()).max(12).default([]),
  personIds: z.array(z.string()).max(30).default([]),
  showInSitemap: z.boolean().default(true),
  status: statusSchema.default('DRAFT'),
  sortOrder: z.number().int().min(0).optional(),
  seo: seoSchema.optional(),
});

export type PageInput = z.infer<typeof pageSchema>;
export const pagePatchSchema = pageSchema.partial();
export type PagePatch = z.infer<typeof pagePatchSchema>;
