import { AlertTriangle, Bot } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/session';
import { aiAccessFor, checkAuthorizeRequest } from '@/server/mcp/consent';

export const metadata = { title: 'Connect an AI client' };
export const dynamic = 'force-dynamic';

/**
 * "Let Claude act as you?" — the one screen of the OAuth flow a person sees.
 *
 * Behind the panel's own sign-in: the middleware sends a signed-out visitor to
 * `/login?next=…` and back here afterwards, so connecting an AI never asks for
 * a password the panel does not already hold. The screen says who the AI will
 * act as, what it may do, and what always waits for a person — the three
 * things worth knowing before pressing Allow.
 */

const SCOPE_COPY: Record<string, { title: string; detail: string }> = {
  'mcp:read': {
    title: 'Read the journeys, journal, pages, places and enquiries',
    detail:
      'Only what your own account may already see. A traveller’s email address and telephone number are never sent to the AI.',
  },
  'mcp:write': {
    title: 'Draft and edit on your behalf',
    detail:
      'Edits to drafts, descriptions and SEO happen straight away. Publishing, prices, deleting and any change to something already published wait for an administrator to approve them in this panel.',
  },
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const get = (name: string) => {
    const value = params[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const check = await checkAuthorizeRequest(get, { requireResponseType: true });
  const access = await aiAccessFor(user);

  return (
    <div className="w-full max-w-lg space-y-5">
      <p className="text-sm font-semibold tracking-tight">Lotus Peak</p>

      {!check.ok ? (
        <Card className="space-y-4 p-6">
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>This connection request cannot be completed</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {check.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            Nothing has been granted. Start the connection again from the AI client.
          </p>
        </Card>
      ) : (
        <Card className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold">Connect {check.client.name} to Lotus Peak?</h1>
              <p className="text-sm text-muted-foreground">
                It will act as <span className="font-medium text-foreground">{user.name}</span> (
                {user.email}), with the <Badge variant="muted">{access.roleName}</Badge> role.
              </p>
            </div>
          </div>

          {!access.allowed && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertTitle>Your account cannot connect an AI client yet</AlertTitle>
              <AlertDescription>{access.reason}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {check.request.scopes.map((scope) => {
              const copy = SCOPE_COPY[scope];
              if (!copy) return null;
              return (
                <div key={scope} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{copy.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{copy.detail}</p>
                </div>
              );
            })}
          </div>

          <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
            <span className="font-medium">It cannot do more than you can.</span> Every action is
            checked against your permissions when it happens, not now. Everything it does is
            recorded under AI clients → Activity, and it can be disconnected at any time under AI clients → Access.
          </p>

          <form method="post" action="/api/oauth/authorize" className="flex justify-end gap-2">
            {(
              [
                ['client_id', check.request.clientId],
                ['redirect_uri', check.request.redirectUri],
                ['state', check.request.state ?? ''],
                ['scope', check.request.scopes.join(' ')],
                ['code_challenge', check.request.codeChallenge],
                ['code_challenge_method', 'S256'],
                ['resource', check.request.resource],
              ] as const
            ).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Button type="submit" name="decision" value="deny" variant="outline">
              Decline
            </Button>
            <Button type="submit" name="decision" value="allow" disabled={!access.allowed}>
              Allow
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
