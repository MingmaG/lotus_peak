'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiDelete, apiPatch, apiPut } from '@/lib/api-client';

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message, { duration: 8_000 });
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function PersonSwitch({
  id,
  name,
  enabled,
  disabled,
}: {
  id: string;
  name: string;
  enabled: boolean;
  disabled?: boolean;
}) {
  const { busy, run } = useAction();
  return (
    <Switch
      checked={enabled}
      disabled={busy || disabled}
      aria-label={`AI access for ${name}`}
      onCheckedChange={(next) =>
        run(
          () => apiPatch(`/api/ai/users/${id}`, { mcpAccessEnabled: next }),
          next ? `${name} may now connect an AI client.` : `${name}’s AI clients are disconnected.`,
        )
      }
    />
  );
}

export function ClientActions({ id, blocked }: { id: string; blocked: boolean }) {
  const { busy, run } = useAction();
  return (
    <div className="flex justify-end gap-2">
      {!blocked && (
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => run(() => apiDelete(`/api/ai/clients/${id}`), 'Disconnected.')}
        >
          Disconnect
        </Button>
      )}
      <Button
        variant={blocked ? 'outline' : 'destructive'}
        size="xs"
        disabled={busy}
        onClick={() =>
          run(() => apiPatch(`/api/ai/clients/${id}`, { isBlocked: !blocked }), blocked ? 'Unblocked.' : 'Blocked.')
        }
      >
        {blocked ? 'Unblock' : 'Block'}
      </Button>
    </div>
  );
}

export function PolicyForm({
  policy,
}: {
  policy: { requireApprovalForAllWrites: boolean; approvalTtlMinutes: number; rateLimitPerMinute: number };
}) {
  const { busy, run } = useAction();
  const [value, setValue] = React.useState(policy);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => apiPut('/api/ai/policy', value), 'Saved.');
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="all-writes">Every write waits for approval</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Even a typo on a draft. The cautious setting while the office learns to trust it.
          </p>
        </div>
        <Switch
          id="all-writes"
          checked={value.requireApprovalForAllWrites}
          onCheckedChange={(next) => setValue({ ...value, requireApprovalForAllWrites: next })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ttl">A request expires after (minutes)</Label>
          <Input
            id="ttl"
            type="number"
            min={5}
            max={10080}
            value={value.approvalTtlMinutes}
            onChange={(event) => setValue({ ...value, approvalTtlMinutes: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rate">Calls a minute, per person</Label>
          <Input
            id="rate"
            type="number"
            min={10}
            max={1000}
            value={value.rateLimitPerMinute}
            onChange={(event) => setValue({ ...value, rateLimitPerMinute: Number(event.target.value) })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={busy}>
          Save the policy
        </Button>
      </div>
    </form>
  );
}
