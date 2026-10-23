import { z } from 'zod';

import { notFound, route } from '@/lib/api/handler';
import { db } from '@/lib/db';
import { revokeTokensFor } from '@/server/mcp/oauth';

/**
 * The per-person switch.
 *
 * Switching it off also revokes every token the person holds, so it bites on
 * the next call rather than when the hour runs out — `verifyAccessToken`
 * would refuse them anyway, and revoking says so in the record too.
 */

const schema = z.object({ mcpAccessEnabled: z.boolean() });

export const PATCH = route<z.infer<typeof schema>, { id: string }>({
  permission: 'ai.delete',
  schema,
  handler: async ({ params, body, audit }) => {
    const user = await db.user.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!user) throw notFound('That account');

    await db.user.update({ where: { id: user.id }, data: { mcpAccessEnabled: body.mcpAccessEnabled } });
    const revoked = body.mcpAccessEnabled ? 0 : await revokeTokensFor({ userId: user.id });

    audit({
      action: 'UPDATE',
      entity: 'user',
      entityId: user.id,
      entityLabel: user.name,
      before: { mcpAccessEnabled: user.mcpAccessEnabled },
      after: { mcpAccessEnabled: body.mcpAccessEnabled },
    });
    return { mcpAccessEnabled: body.mcpAccessEnabled, revokedTokens: revoked };
  },
});
