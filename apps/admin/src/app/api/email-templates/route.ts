import { route } from '@/lib/api/handler';
import { db } from '@/lib/db';
import { TEMPLATE_TOKENS } from '@lotuspeak/email';

export const GET = route({
  permission: 'emails.read',
  handler: async () => ({
    templates: await db.emailTemplate.findMany({ orderBy: { kind: 'asc' } }),
    /* What each kind may reference, so the editor can list the tokens beside
       the field rather than leaving somebody to guess. */
    tokens: TEMPLATE_TOKENS,
  }),
});
