import { route } from '@/lib/api/handler';
import { getAiPolicy, policySchema, saveAiPolicy, type AiPolicy } from '@/server/mcp/policy';

export const PUT = route<AiPolicy>({
  permission: 'ai.delete',
  schema: policySchema,
  handler: async ({ body, audit }) => {
    const before = await getAiPolicy();
    await saveAiPolicy(body);
    audit({
      action: 'UPDATE',
      entity: 'setting',
      entityLabel: 'AI approval policy',
      before: before as never,
      after: body as never,
    });
    return { policy: body };
  },
});
