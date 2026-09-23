'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { EditorPage } from '@/components/shared/editor-page';
import { Field } from '@/components/shared/editor-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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

export interface RoleEditorForm {
  id: string | null;
  name: string;
  description: string;
  permissions: string[];
}

const BACK = '/users?tab=roles';

/**
 * One role, on a page of its own.
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
export function RoleEditor({
  initial,
  canManage,
  canDelete,
}: {
  initial: RoleEditorForm;
  canManage: boolean;
  /** A custom role only; the API refuses a shipped one, and a role anybody still has. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft] = React.useState(initial);
  const [signOutEveryone, setSignOutEveryone] = React.useState(false);

  const done = (message: string) => {
    void client.invalidateQueries({ queryKey: ['roles'] });
    /* The Accounts tab shows each person's role name beside them. */
    void client.invalidateQueries({ queryKey: ['users'] });
    toast.success(message);
    router.push(BACK);
    router.refresh();
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name,
        description: draft.description || null,
        permissions: draft.permissions,
      };
      return draft.id
        ? apiPatch<{ signedOut: number }>(`/api/roles/${draft.id}`, { ...body, signOutEveryone })
        : apiPost<{ signedOut: number }>('/api/roles', body);
    },
    onSuccess: (result) =>
      done(
        result?.signedOut
          ? `Saved. ${result.signedOut} ${result.signedOut === 1 ? 'session was' : 'sessions were'} ended — they will be asked to sign in again.`
          : 'Saved',
      ),
    onError: (error: Error) => toast.error(error.message, { duration: 10_000 }),
  });

  const remove = useMutation({
    mutationFn: () => apiDelete(`/api/roles/${draft.id}`),
    onSuccess: () => done('Removed'),
    onError: (error: Error) => toast.error(error.message, { duration: 10_000 }),
  });

  const title = draft.id ? initial.name : 'A new role';

  return (
    <EditorPage
      title={title}
      description="A change reaches somebody who is already signed in within fifteen minutes, when their sign-in is next checked against the database."
      crumbs={[
        { label: 'Accounts', href: '/users' },
        { label: 'Roles', href: BACK },
        { label: title },
      ]}
      backHref={BACK}
      onSave={() => save.mutate()}
      isSaving={save.isPending}
      canSave={canManage}
      onDelete={draft.id && canDelete ? () => remove.mutate() : undefined}
      deleteDescription="A role can only be removed once nobody has it. This cannot be undone — the permissions would have to be ticked again."
    >
      <div className="max-w-2xl space-y-4">
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
      </div>

      <PermissionMatrix
        held={draft.permissions}
        disabled={!canManage}
        onChange={(permissions) => setDraft({ ...draft, permissions })}
      />

      {draft.id && canManage && (
        <label className="flex max-w-2xl items-start gap-3 text-left">
          <Switch checked={signOutEveryone} onCheckedChange={setSignOutEveryone} />
          <span className="text-xs text-muted-foreground">
            Also sign everybody in this role out, so they have to type their password again.
            Their open tab keeps working for up to fifteen minutes; it is the staying signed in
            that stops. Use it when you are taking access away.
          </span>
        </label>
      )}
    </EditorPage>
  );
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
