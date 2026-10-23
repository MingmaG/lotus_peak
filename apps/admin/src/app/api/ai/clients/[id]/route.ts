import { z } from 'zod';

import { notFound, route } from '@/lib/api/handler';
import { db } from '@/lib/db';
import { revokeTokensFor } from '@/server/mcp/oauth';

/**
 * Blocking an AI client, or disconnecting it.
 *
 * Disconnecting revokes its tokens: whoever was using it signs in again. Blocking
 * does that and refuses it at every door from then on — consent, token and
 * every call — until it is unblocked.
 */

const schema = z.object({ isBlocked: z.boolean() });

async function load(id: string) {
  const client = await db.mcpOAuthClient.findUnique({ where: { id } });
  if (!client) throw notFound('That AI client');
  return client;
}

export const PATCH = route<z.infer<typeof schema>, { id: string }>({
  permission: 'ai.delete',
  schema,
  handler: async ({ params, body, audit }) => {
    const client = await load(params.id);
    await db.mcpOAuthClient.update({ where: { id: client.id }, data: { isBlocked: body.isBlocked } });
    if (body.isBlocked) await revokeTokensFor({ clientId: client.clientId });
    audit({
      action: 'UPDATE',
      entity: 'ai-client',
      entityId: client.id,
      entityLabel: client.name,
      before: { isBlocked: client.isBlocked },
      after: { isBlocked: body.isBlocked },
    });
    return { isBlocked: body.isBlocked };
  },
});

/** Disconnect: every token this client holds, for everybody, stops now. */
export const DELETE = route<undefined, { id: string }>({
  permission: 'ai.delete',
  handler: async ({ params, audit }) => {
    const client = await load(params.id);
    const revoked = await revokeTokensFor({ clientId: client.clientId });
    audit({ action: 'UPDATE', entity: 'ai-client', entityId: client.id, entityLabel: client.name, after: { disconnected: revoked } });
    return { revokedTokens: revoked };
  },
});
