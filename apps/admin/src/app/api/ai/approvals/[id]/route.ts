import { z } from 'zod';

import { route } from '@/lib/api/handler';
import { approveApproval, rejectApproval } from '@/server/mcp/approvals';

/**
 * Deciding what an AI asked for.
 *
 * The only way an approved request is ever carried out: a signed-in person's
 * browser, posting here. `approveApproval` checks the rest — that the approver
 * also holds what the request itself needs, that it has not expired, and that
 * the record has not moved since it was asked for.
 */

const schema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve') }),
  z.object({ decision: z.literal('reject'), reason: z.string().max(1_000).default('') }),
]);

export const POST = route<z.infer<typeof schema>, { id: string }>({
  permission: 'ai.publish',
  schema,
  handler: async ({ params, body, user }) => {
    const outcome =
      body.decision === 'approve'
        ? await approveApproval(params.id, user)
        : await rejectApproval(params.id, user, body.reason);
    return { outcome };
  },
});
