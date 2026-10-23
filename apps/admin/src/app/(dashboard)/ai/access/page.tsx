import { ClientActions, PersonSwitch, PolicyForm } from '@/components/ai/access-controls';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { relativeTime } from '@/lib/format';
import { getAiPolicy } from '@/server/mcp/policy';

export const metadata = { title: 'AI access' };
export const dynamic = 'force-dynamic';

/**
 * Who may work through an AI, which AI clients are connected, and what waits
 * for a person.
 *
 * Two switches decide whether somebody may connect: their role's “AI clients →
 * Change”, set on the Roles screen, and their own switch here. Both are off by
 * default, and both are checked on every call an AI makes — not only when it
 * connects — so turning either off works at once.
 */
export default async function AiAccessPage() {
  const user = await requirePermission('ai.read');
  const mayManage = can(user.permissions, 'ai.delete');

  const [people, clients, policy] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        mcpAccessEnabled: true,
        role: { select: { name: true, permissions: true } },
      },
    }),
    db.mcpOAuthClient.findMany({
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      include: {
        tokens: {
          where: { revokedAt: null, refreshExpiresAt: { gt: new Date() } },
          select: { user: { select: { name: true } } },
        },
      },
    }),
    getAiPolicy(),
  ]);

  return (
    <>
      <PageHeader
        title="AI access"
        description="Who may work through Claude, ChatGPT or another AI client, which clients are connected, and how cautious the approval rules are."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">People</h2>
        <Card className="divide-y p-0">
          {people.map((person) => {
            const roleAllows = can(person.role.permissions, 'ai.write');
            return (
              <div key={person.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.role.name}
                    {!roleAllows && ' — this role may not use AI clients; grant “AI clients → Change” on the Roles screen'}
                  </p>
                </div>
                <PersonSwitch
                  id={person.id}
                  name={person.name}
                  enabled={person.mcpAccessEnabled}
                  disabled={!mayManage}
                />
              </div>
            );
          })}
        </Card>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium">Connected clients</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No AI client has registered yet. See AI clients → Connect a client.
          </p>
        ) : (
          <Card className="divide-y p-0">
            {clients.map((client) => {
              const holders = [...new Set(client.tokens.map((token) => token.user.name))];
              return (
                <div key={client.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      {client.name}
                      {client.isBlocked && <Badge variant="destructive">blocked</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {holders.length ? `Signed in: ${holders.join(', ')}` : 'Nobody signed in'} · last used{' '}
                      {client.lastUsedAt ? relativeTime(client.lastUsedAt) : 'never'}
                    </p>
                  </div>
                  {mayManage && <ClientActions id={client.id} blocked={client.isBlocked} />}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium">Approval policy</h2>
        <Card className="space-y-4 p-5">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Always waits for a person, whatever is set here: publishing and unpublishing, any price, a new departure date, deleting, a redirect, and any edit to something already published.</p>
            <p>Happens at once: reading, edits to drafts, SEO, photograph descriptions, and working the enquiries desk.</p>
          </div>
          {mayManage ? (
            <PolicyForm policy={policy} />
          ) : (
            <p className="text-sm">
              {policy.requireApprovalForAllWrites ? 'Every write waits for approval.' : 'Only the writes above wait.'}{' '}
              Requests expire after {policy.approvalTtlMinutes} minutes.
            </p>
          )}
        </Card>
      </section>
    </>
  );
}
