'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/shared/editor-shell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import {
  ACTIONS,
  ACTION_META,
  RESOURCES,
  RESOURCE_GROUPS,
  RESOURCE_META,
  actionsFor,
  can,
  type Action,
  type Permission,
  type Resource,
  type ResourceGroup,
} from '@/lib/auth/permissions';

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

interface Draft {
  id: string | null;
  name: string;
  description: string;
  permissions: string[];
  signOutEveryone: boolean;
}

/**
 * What each role may do.
 *
 * The editor is a matrix and not a list of strings, because the question the
 * office actually asks is "can the receptionist see the customers" — one row,
 * one tick — and `customers.read` is the answer to a different question.
 *
 * A tick that a higher action already implies is shown ticked and disabled
 * rather than hidden. Somebody who may publish a journey may obviously read
 * one; drawing that box empty would say the opposite, and letting it be
 * cleared would be a lie the moment `can()` was next asked.
 */
export function RolesScreen({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Role | null>(null);

  const { data, isLoading } = useQuery<{ roles: Role[] }>({
    queryKey: ['roles'],
    queryFn: () => fetch('/api/roles').then((response) => response.json()),
  });

  const done = (message: string) => {
    void client.invalidateQueries({ queryKey: ['roles'] });
    /* The Accounts tab shows each person's role name beside them. */
    void client.invalidateQueries({ queryKey: ['users'] });
    toast.success(message);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('Nothing to save.');
      const body = {
        name: draft.name,
        description: draft.description || null,
        permissions: draft.permissions,
      };
      return draft.id
        ? apiPatch<{ signedOut: number }>(`/api/roles/${draft.id}`, {
            ...body,
            signOutEveryone: draft.signOutEveryone,
          })
        : apiPost<{ signedOut: number }>('/api/roles', body);
    },
    onSuccess: (result) => {
      setDraft(null);
      done(
        result?.signedOut
          ? `Saved. ${result.signedOut} ${result.signedOut === 1 ? 'session was' : 'sessions were'} ended — they will be asked to sign in again.`
          : 'Saved',
      );
    },
    onError: (error: Error) => toast.error(error.message, { duration: 10_000 }),
  });

  const remove = useMutation({
    mutationFn: (role: Role) => apiDelete(`/api/roles/${role.id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      done('Removed');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 10_000 }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const isOwner = (role: Role) => role.slug === 'owner';

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border">
        {data.roles.map((role) => (
          <li key={role.id} className="flex flex-wrap items-center gap-3 p-4">
            <button
              type="button"
              disabled={isOwner(role)}
              onClick={() =>
                setDraft({
                  id: role.id,
                  name: role.name,
                  description: role.description ?? '',
                  permissions: [...role.permissions],
                  signOutEveryone: false,
                })
              }
              className="min-w-0 flex-1 text-left disabled:cursor-default"
            >
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {role.name}
                {isOwner(role) && (
                  <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <Lock className="size-3" />
                    everything, always
                  </span>
                )}
                {role.isSystem && !isOwner(role) && (
                  <span className="text-[11px] font-normal text-muted-foreground">shipped</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {role.description ?? 'No description.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {role.userCount === 0
                  ? 'Nobody has this role'
                  : `${role.userCount} ${role.userCount === 1 ? 'person' : 'people'}`}
                {' · '}
                {summarise(role)}
              </p>
            </button>

            {canManage && !role.isSystem && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(role)}
                aria-label={`Remove the ${role.name} role`}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft({
              id: null,
              name: '',
              description: '',
              permissions: ['dashboard.read'],
              signOutEveryone: false,
            })
          }
        >
          <Plus className="mr-1.5 size-3.5" />
          Add a role
        </Button>
      )}

      <Sheet open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-2xl">
          {draft && (
            <>
              <SheetHeader>
                <SheetTitle>{draft.id ? draft.name : 'A new role'}</SheetTitle>
                <SheetDescription>
                  A change reaches somebody who is already signed in within fifteen minutes,
                  when their sign-in is next checked against the database.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 py-4">
                <Field label="Name" htmlFor="role-name">
                  <Input
                    id="role-name"
                    value={draft.name}
                    disabled={!canManage}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </Field>

                <Field
                  label="What this role is for"
                  htmlFor="role-description"
                  hint="Shown when somebody picks a role for a new account. A sentence saves a conversation."
                >
                  <Textarea
                    id="role-description"
                    rows={2}
                    value={draft.description}
                    disabled={!canManage}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                </Field>

                <PermissionMatrix
                  held={draft.permissions}
                  disabled={!canManage}
                  onChange={(permissions) => setDraft({ ...draft, permissions })}
                />
              </div>

              <SheetFooter className="flex-col items-stretch gap-3 border-t pt-4">
                {draft.id && canManage && (
                  <label className="flex items-start gap-3 text-left">
                    <Switch
                      checked={draft.signOutEveryone}
                      onCheckedChange={(signOutEveryone) =>
                        setDraft({ ...draft, signOutEveryone })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      Also sign everybody in this role out, so they have to type their password
                      again. Their open tab keeps working for up to fifteen minutes; it is the
                      staying signed in that stops. Use it when you are taking access away.
                    </span>
                  </label>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDraft(null)}>
                    {canManage ? 'Cancel' : 'Close'}
                  </Button>
                  {canManage && (
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Save
                    </Button>
                  )}
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the {confirmDelete?.name} role?</AlertDialogTitle>
            <AlertDialogDescription>
              A role can only be removed once nobody has it. This cannot be undone — the
              permissions would have to be ticked again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** "Sees 14 areas, changes 6" — the shape of a role, without reading 30 strings. */
function summarise(role: Role): string {
  if (role.permissions.includes('*')) return 'Every permission there is';

  const sees = RESOURCES.filter((resource) => can(role.permissions, `${resource}.read`));
  const changes = RESOURCES.filter(
    (resource) =>
      !RESOURCE_META[resource].readOnly && can(role.permissions, `${resource}.write`),
  );

  if (sees.length === 0) return 'Nothing yet';
  return `sees ${sees.length} of ${RESOURCES.length} areas, changes ${changes.length}`;
}

const GROUPED: { group: ResourceGroup; resources: Resource[] }[] = RESOURCE_GROUPS.map(
  (group) => ({
    group,
    resources: RESOURCES.filter((resource) => RESOURCE_META[resource].group === group),
  }),
);

function PermissionMatrix({
  held,
  disabled,
  onChange,
}: {
  held: string[];
  disabled: boolean;
  onChange: (held: string[]) => void;
}) {
  const toggle = (resource: Resource, action: Action, on: boolean) => {
    const key: Permission = `${resource}.${action}`;
    onChange(on ? [...held, key] : held.filter((one) => one !== key));
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium leading-none">What this role may do</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          A tick that is greyed out is one a higher permission already includes — somebody who
          may publish a journey can read one. Untick the higher permission to take it away.
        </p>
      </div>

      {GROUPED.map(({ group, resources }) => (
        <div key={group} className="rounded-lg border">
          <p className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">{group}</p>
          <ul className="divide-y">
            {resources.map((resource) => {
              const meta = RESOURCE_META[resource];
              return (
                <li
                  key={resource}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{meta.label}</p>
                    {meta.hint && (
                      <p className="text-xs text-muted-foreground">{meta.hint}</p>
                    )}
                  </div>

                  {/* A fixed column per action, including for the resources
                      that do not have one: a Remove tick that sits under
                      Publish on the row above is a tick somebody will click by
                      mistake while reading down the column. */}
                  <div className="grid shrink-0 grid-cols-4 gap-x-2">
                    {ACTIONS.map((action) => {
                      if (!actionsFor(resource).includes(action)) {
                        return <span key={action} aria-hidden className="w-[4.5rem]" />;
                      }
                      const key: Permission = `${resource}.${action}`;
                      /**
                       * Granted by something else in the set, rather than by
                       * this box. Asked with this box's own permission removed,
                       * so a role that holds both `trips.read` and
                       * `trips.publish` still shows Read as inherited — the box
                       * that turns it off is Publish, and leaving Read clickable
                       * there is a tick that does nothing when you clear it.
                       */
                      const inherited = can(
                        held.filter((one) => one !== key),
                        key,
                      );
                      const explicit = held.includes(key);

                      return (
                        <label
                          key={action}
                          className="flex w-[4.5rem] items-center gap-1.5 text-xs"
                          title={ACTION_META[action].hint}
                        >
                          <Checkbox
                            checked={explicit || inherited}
                            disabled={disabled || inherited}
                            onCheckedChange={(state) => toggle(resource, action, state === true)}
                            aria-label={`${ACTION_META[action].label} — ${meta.label}`}
                          />
                          <span className={inherited ? 'text-muted-foreground' : undefined}>
                            {ACTION_META[action].label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
