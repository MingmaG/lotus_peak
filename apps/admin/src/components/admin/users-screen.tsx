'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { apiPatch } from '@/lib/api-client';
import { relativeTime } from '@/lib/format';

interface User {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  role: { id: string; name: string; slug: string };
  _count: { sessions: number };
}

/**
 * Who may sign in. A row opens the account on a page of its own; locking and
 * switching an account off stay here, because they are one click each.
 */
export function UsersScreen({
  currentUserId,
  canWrite,
}: {
  currentUserId: string;
  canWrite: boolean;
}) {
  const client = useQueryClient();

  const { data, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then((response) => response.json()),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => apiPatch(`/api/users/${id}`, body),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['users'] }),
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border">
        {data.users.map((user) => {
          const locked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
          return (
            <li key={user.id} className="flex flex-wrap items-center gap-3 p-4">
              <Link href={`/users/${user.id}`} className="min-w-0 flex-1 text-left">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="text-[11px] font-normal text-muted-foreground">you</span>
                  )}
                  {locked && (
                    <span className="flex items-center gap-1 text-[11px] font-normal text-status-attention">
                      <ShieldAlert className="size-3" />
                      locked out
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email} · {user.role.name}
                  {user.lastLoginAt
                    ? ` · last in ${relativeTime(user.lastLoginAt)}`
                    : ' · never signed in'}
                  {user._count.sessions > 0 && ` · ${user._count.sessions} sessions`}
                </p>
              </Link>

              {locked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => patch.mutate({ id: user.id, body: { unlock: true } })}
                >
                  Unlock
                </Button>
              )}

              <Switch
                checked={user.isActive}
                disabled={user.id === currentUserId}
                onCheckedChange={(isActive) => patch.mutate({ id: user.id, body: { isActive } })}
                aria-label={`${user.isActive ? 'Deactivate' : 'Activate'} ${user.name}`}
              />
            </li>
          );
        })}
      </ul>

      {canWrite && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/users/new">
            <Plus className="mr-1.5 size-3.5" />
            Add somebody
          </Link>
        </Button>
      )}
    </div>
  );
}
