import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mcpResourceUrl } from '@/server/mcp/oauth';

export const metadata = { title: 'Connect an AI client' };
export const dynamic = 'force-dynamic';

/**
 * The address, and the three ways in.
 *
 * Open to anybody signed in, because the person who most needs this page is
 * the one whose access has not been switched on yet — and it says so.
 */
export default async function ConnectPage() {
  const user = await requireUser();
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { mcpAccessEnabled: true, role: { select: { name: true, permissions: true } } },
  });
  const roleAllows = can(row?.role.permissions, 'ai.write');
  const address = mcpResourceUrl();

  return (
    <>
      <PageHeader
        title="Connect an AI client"
        description="Work the panel by conversation from Claude, Claude Code or ChatGPT. The AI acts as you, with your permissions and no more, and anything that changes the live website waits for approval under AI clients → Approvals."
      />

      <Card className="mb-6 space-y-2 p-5 text-sm">
        <p className="font-medium">Your account</p>
        <p>
          Role: {row?.role.name} — {roleAllows ? 'may use AI clients.' : 'may not use AI clients yet. The owner can grant “AI clients → Change” on the Roles screen.'}
        </p>
        <p>
          Your AI access is {row?.mcpAccessEnabled ? 'switched on.' : 'switched off. Somebody who manages AI access can switch it on under AI clients → Access.'}
        </p>
      </Card>

      <Card className="space-y-5 p-5 text-sm">
        <div>
          <p className="font-medium">The address</p>
          <code className="mt-1 block break-all rounded bg-muted px-3 py-2">{address}</code>
        </div>
        <div>
          <p className="font-medium">Claude (claude.ai and the app)</p>
          <p className="text-muted-foreground">
            Settings → Connectors → Add custom connector. Paste the address; leave the client id and
            secret empty. Claude opens this panel to ask you to allow it.
          </p>
        </div>
        <div>
          <p className="font-medium">Claude Code</p>
          <code className="mt-1 block break-all rounded bg-muted px-3 py-2">
            claude mcp add --transport http lotuspeak {address}
          </code>
          <p className="mt-1 text-muted-foreground">Then run <code>/mcp</code> and choose it to sign in.</p>
        </div>
        <div>
          <p className="font-medium">ChatGPT</p>
          <p className="text-muted-foreground">
            Settings → Connectors → Create, with the address above and OAuth as the authentication.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          A hosted client — Claude, ChatGPT — needs this address to be reachable over https from the
          internet. Claude Code on this machine can use it as it is.
        </p>
      </Card>
    </>
  );
}
