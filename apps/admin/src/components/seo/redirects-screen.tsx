'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Link2, Lock, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { Field } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Redirect {
  id: string;
  source: string;
  target: string;
  type: 'MOVED_301' | 'FOUND_302';
  isActive: boolean;
  isAutomatic: boolean;
  hitCount: number;
  lastHitAt: string | null;
  note: string | null;
}

interface Miss {
  path: string;
  referrer: string | null;
  hitCount: number;
  lastHitAt: string;
}

/**
 * Redirects, and the addresses people are actually asking for.
 *
 * Two lists, and the second is why this screen is useful. A redirect table on
 * its own is a list of decisions somebody made; beside a list of 404s with hit
 * counts and referrers it becomes a job: these four addresses are being asked
 * for, this one has a referrer from another site, point it somewhere.
 */
export function RedirectsScreen({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [tab, setTab] = React.useState('redirects');
  const [adding, setAdding] = React.useState<{ source: string; target: string } | null>(null);

  const { data: redirects } = useQuery<{ items: Redirect[] }>({
    queryKey: ['redirects'],
    queryFn: () => apiGet('/api/redirects?perPage=100'),
  });

  const { data: misses } = useQuery<{ items: Miss[] }>({
    queryKey: ['not-found'],
    queryFn: () => apiGet('/api/not-found-logs'),
  });

  const create = useMutation({
    mutationFn: (body: unknown) => apiPost('/api/redirects', body),
    onSuccess: (_result, body) => {
      void client.invalidateQueries({ queryKey: ['redirects'] });
      /* Resolving the 404 it came from, so the list of jobs gets shorter. */
      const source = (body as { source: string }).source;
      void apiPatch('/api/not-found-logs', { paths: [source], resolved: true }).then(() =>
        client.invalidateQueries({ queryKey: ['not-found'] }),
      );
      setAdding(null);
      toast.success('Added');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      apiPatch(`/api/redirects/${id}`, body),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['redirects'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/redirects/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['redirects'] }),
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const resolve = useMutation({
    mutationFn: (paths: string[]) => apiPatch('/api/not-found-logs', { paths, resolved: true }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['not-found'] }),
  });

  const missCount = misses?.items.length ?? 0;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="redirects">
            Redirects
            {redirects?.items.length ? (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {redirects.items.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="misses">
            Being asked for
            {missCount > 0 && (
              <span className="ml-1.5 rounded bg-status-attention/15 px-1 text-xs tabular-nums text-status-attention">
                {missCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'redirects' && (
        <>
          {canWrite && (
            <div className="rounded-lg border p-3">
              {adding ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="From" hint="A path on this site, starting with /">
                      <Input
                        value={adding.source}
                        onChange={(event) => setAdding({ ...adding, source: event.target.value })}
                        placeholder="/old-page"
                      />
                    </Field>
                    <Field label="To">
                      <Input
                        value={adding.target}
                        onChange={(event) => setAdding({ ...adding, target: event.target.value })}
                        placeholder="/trips"
                      />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!adding.source || !adding.target || create.isPending}
                      onClick={() => create.mutate({ ...adding, type: 'MOVED_301' })}
                    >
                      Add it
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAdding(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdding({ source: '', target: '' })}
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Add a redirect
                </Button>
              )}
            </div>
          )}

          {(redirects?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={Link2}
              title="No redirects"
              description="One is written automatically whenever a page is renamed, so this fills itself in as the site changes."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {redirects?.items.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm">
                      <code className="rounded bg-muted px-1 text-xs">{row.source}</code>
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                      <code className="rounded bg-muted px-1 text-xs">{row.target}</code>
                      {row.isAutomatic && (
                        <span
                          className="flex items-center gap-1 text-[11px] text-muted-foreground"
                          title="Written when a page was renamed. It is what keeps the old address working."
                        >
                          <Lock className="size-3" />
                          automatic
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.type === 'MOVED_301' ? 'Permanent' : 'Temporary'}
                      {row.hitCount > 0 &&
                        ` · followed ${row.hitCount} ${row.hitCount === 1 ? 'time' : 'times'}, last ${relativeTime(row.lastHitAt)}`}
                      {row.note && ` · ${row.note}`}
                    </p>
                  </div>

                  {canWrite && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Select
                        value={row.type}
                        onValueChange={(type) => patch.mutate({ id: row.id, body: { type } })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MOVED_301">Permanent</SelectItem>
                          <SelectItem value="FOUND_302">Temporary</SelectItem>
                        </SelectContent>
                      </Select>

                      <Switch
                        checked={row.isActive}
                        onCheckedChange={(isActive) =>
                          patch.mutate({ id: row.id, body: { isActive } })
                        }
                        aria-label="Switch this redirect on or off"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'size-8 text-muted-foreground hover:text-destructive',
                          row.isAutomatic && 'opacity-40',
                        )}
                        onClick={() => {
                          if (window.confirm(`Delete the redirect from ${row.source}?`)) {
                            destroy.mutate(row.id);
                          }
                        }}
                        aria-label={`Delete the redirect from ${row.source}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'misses' && (
        <>
          {missCount === 0 ? (
            <EmptyState
              icon={Check}
              title="Nothing is being asked for that is not there"
              description="Addresses that 404 turn up here with a count and, where there is one, the site that linked to them."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {misses?.items.map((row) => (
                <li key={row.path} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <code className="rounded bg-muted px-1 text-xs">{row.path}</code>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.hitCount} {row.hitCount === 1 ? 'time' : 'times'} · last{' '}
                      {relativeTime(row.lastHitAt)}
                      {row.referrer ? (
                        /* The one that matters: a real link from somewhere else. */
                        <span className="text-status-attention"> · linked from {row.referrer}</span>
                      ) : (
                        ' · no referrer, probably a bot'
                      )}
                    </p>
                  </div>

                  {canWrite && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTab('redirects');
                          setAdding({ source: row.path, target: '' });
                        }}
                      >
                        Point it somewhere
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resolve.mutate([row.path])}
                      >
                        Ignore
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
