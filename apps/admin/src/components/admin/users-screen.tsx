'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { apiPatch, apiPost } from '@/lib/api-client';
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

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
}

interface Form {
  id: string | null;
  name: string;
  email: string;
  jobTitle: string;
  roleId: string;
  password: string;
  isActive: boolean;
}

/**
 * Who may sign in, and what they may do.
 *
 * The roles are shown with their descriptions rather than their permission
 * strings: "writes and publishes everything on the website; no access to
 * enquiries, customers or settings" is a sentence somebody can make a decision
 * from, and `journal.publish, pages.publish, …` is not.
 */
export function UsersScreen({ currentUserId }: { currentUserId: string }) {
  const client = useQueryClient();
  const [editing, setEditing] = React.useState<Form | null>(null);

  const { data, isLoading } = useQuery<{ users: User[]; roles: Role[] }>({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then((response) => response.json()),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Nothing to save.');
      return editing.id
        ? apiPatch(`/api/users/${editing.id}`, {
            name: editing.name,
            jobTitle: editing.jobTitle || null,
            roleId: editing.roleId,
            isActive: editing.isActive,
            ...(editing.password ? { password: editing.password } : {}),
          })
        : apiPost('/api/users', {
            name: editing.name,
            email: editing.email,
            jobTitle: editing.jobTitle || null,
            roleId: editing.roleId,
            password: editing.password,
          });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
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

  const roleById = new Map(data.roles.map((role) => [role.id, role]));

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border">
        {data.users.map((user) => {
          const locked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
          return (
            <li key={user.id} className="flex flex-wrap items-center gap-3 p-4">
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    jobTitle: user.jobTitle ?? '',
                    roleId: user.role.id,
                    password: '',
                    isActive: user.isActive,
                  })
                }
                className="min-w-0 flex-1 text-left"
              >
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
              </button>

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

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setEditing({
            id: null,
            name: '',
            email: '',
            jobTitle: '',
            roleId: data.roles.find((role) => role.slug === 'editor')?.id ?? data.roles[0]?.id ?? '',
            password: '',
            isActive: true,
          })
        }
      >
        <Plus className="mr-1.5 size-3.5" />
        Add somebody
      </Button>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>{editing.id ? editing.name : 'A new account'}</SheetTitle>
                <SheetDescription>
                  {editing.id
                    ? 'Changing the password signs them out of every browser.'
                    : 'They will sign in with this email address and password.'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 py-4">
                <Field label="Name">
                  <Input
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  />
                </Field>

                <Field
                  label="Email"
                  hint={editing.id ? 'An address cannot be changed once it is in use.' : undefined}
                >
                  <Input
                    type="email"
                    value={editing.email}
                    disabled={Boolean(editing.id)}
                    onChange={(event) => setEditing({ ...editing, email: event.target.value })}
                  />
                </Field>

                <Field label="What they do" hint="Shown beside a journal entry they wrote.">
                  <Input
                    value={editing.jobTitle}
                    onChange={(event) => setEditing({ ...editing, jobTitle: event.target.value })}
                  />
                </Field>

                <Field
                  label="Role"
                  hint={roleById.get(editing.roleId)?.description ?? undefined}
                >
                  <Select
                    value={editing.roleId}
                    disabled={editing.id === currentUserId}
                    onValueChange={(roleId) => setEditing({ ...editing, roleId })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label={editing.id ? 'New password' : 'Password'}
                  hint="Twelve characters at least. A phrase is easier to remember and harder to guess than a word with symbols in it."
                >
                  <Input
                    type="password"
                    value={editing.password}
                    autoComplete="new-password"
                    placeholder={editing.id ? 'Leave empty to keep the current one' : ''}
                    onChange={(event) => setEditing({ ...editing, password: event.target.value })}
                  />
                </Field>
              </div>

              <SheetFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
