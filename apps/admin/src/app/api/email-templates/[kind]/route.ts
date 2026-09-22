import { TEMPLATE_TOKENS, type EmailKind } from '@lotuspeak/email';
import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, notFound, route } from '@/lib/api/handler';
import { revalidateFor } from '@/server/services/revalidate';

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
  subject: z.string().min(1, 'A message needs a subject.').max(300).optional(),
  preheader: z.string().max(300).optional(),
  eyebrow: z.string().max(120).optional(),
  heading: z.string().max(200).optional(),
  intro: z.string().max(4_000).optional(),
  closing: z.string().max(4_000).optional(),
  summaryLabel: z.string().max(120).optional(),
  notesLabel: z.string().max(120).optional(),
  buttonLabel: z.string().max(60).optional(),
  buttonUrl: z.string().max(500).optional(),
  signOff: z.string().max(400).optional(),
  footNote: z.string().max(600).optional(),
});

export const PATCH = route<z.infer<typeof schema>, { kind: string }>({
  permission: 'emails.write',
  schema,
  handler: async ({ params, body, audit }) => {
    const kind = params.kind.toUpperCase() as EmailKind;
    const allowed = TEMPLATE_TOKENS[kind];
    if (!allowed) throw notFound('That template');

    /**
     * A token the message cannot fill is refused on save.
     *
     * `fill()` replaces an unknown token with an empty string, so a typo'd
     * `{{deparutre}}` would go out as a gap in a sentence to a customer. The
     * editor is where that should be caught, and the message names the token
     * and lists the ones that exist.
     */
    const used = new Set<string>();
    for (const value of Object.values(body)) {
      if (typeof value !== 'string') continue;
      for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
        if (match[1]) used.add(match[1]);
      }
    }

    const unknown = [...used].filter((token) => !allowed.includes(token));
    if (unknown.length > 0) {
      throw new ApiError(
        422,
        'UNKNOWN_TOKEN',
        `${unknown.map((token) => `{{${token}}}`).join(', ')} ${unknown.length === 1 ? 'is not a value' : 'are not values'} this message has. It can use: ${allowed.map((token) => `{{${token}}}`).join(', ')}.`,
      );
    }

    const template = await db.emailTemplate.update({ where: { kind }, data: body });

    audit({
      action: 'UPDATE',
      entity: 'emailTemplate',
      entityId: template.id,
      entityLabel: template.name,
    });
    void revalidateFor('email');
    return { template };
  },
});
