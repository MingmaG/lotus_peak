'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { EditorPage } from '@/components/shared/editor-page';
import { Field } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiPatch, apiPost } from '@/lib/api-client';

export interface UserEditorRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface UserEditorForm {
  id: string | null;
  name: string;
  email: string;
  jobTitle: string;
  roleId: string;
  isActive: boolean;
}

/**
 * One account, on a page of its own.
 *
 * The password is never loaded — only ever written. An empty field on an
 * existing account means "keep the current one", which is why it is not part
 * of the form that comes from the server.
 *
 * The roles are shown with their descriptions rather than their permission
 * strings: "writes and publishes everything on the website; no access to
 * enquiries, customers or settings" is a sentence somebody can make a decision
 * from, and `journal.publish, pages.publish, …` is not.
 */
export function UserEditor({
  initial,
  roles,
  currentUserId,
  canWrite,
}: {
  initial: UserEditorForm;
  roles: UserEditorRole[];
  currentUserId: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = React.useState(initial);
  const [password, setPassword] = React.useState('');

  const roleById = new Map(roles.map((role) => [role.id, role]));

  const save = useMutation({
    mutationFn: () =>
      form.id
        ? apiPatch(`/api/users/${form.id}`, {
            name: form.name,
            jobTitle: form.jobTitle || null,
            roleId: form.roleId,
            isActive: form.isActive,
            ...(password ? { password } : {}),
          })
        : apiPost('/api/users', {
            name: form.name,
            email: form.email,
            jobTitle: form.jobTitle || null,
            roleId: form.roleId,
            password,
          }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['users'] });
      /* A role's tally of people moves when somebody joins or changes it. */
      void client.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Saved');
      router.push('/users');
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const title = form.id ? initial.name : 'A new account';

  return (
    <EditorPage
      title={title}
      description={
        form.id
          ? 'Changing the password signs them out of every browser.'
          : 'They will sign in with this email address and password.'
      }
      crumbs={[{ label: 'Accounts', href: '/users' }, { label: title }]}
      backHref="/users"
      onSave={() => save.mutate()}
      isSaving={save.isPending}
      canSave={canWrite}
    >
      <div className="max-w-2xl space-y-4">
        <Field label="Name">
          <Input
            value={form.name}
            disabled={!canWrite}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>

        <Field
          label="Email"
          hint={form.id ? 'An address cannot be changed once it is in use.' : undefined}
        >
          <Input
            type="email"
            value={form.email}
            disabled={Boolean(form.id) || !canWrite}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>

        <Field label="What they do" hint="Shown beside a journal entry they wrote.">
          <Input
            value={form.jobTitle}
            disabled={!canWrite}
            onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
          />
        </Field>

        <Field label="Role" hint={roleById.get(form.roleId)?.description ?? undefined}>
          <Select
            value={form.roleId}
            /* The API refuses a change to your own role; the field says so
               before Save does. */
            disabled={form.id === currentUserId || !canWrite}
            onValueChange={(roleId) => setForm({ ...form, roleId })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={form.id ? 'New password' : 'Password'}
          hint="Twelve characters at least. A phrase is easier to remember and harder to guess than a word with symbols in it."
        >
          <Input
            type="password"
            value={password}
            autoComplete="new-password"
            disabled={!canWrite}
            placeholder={form.id ? 'Leave empty to keep the current one' : ''}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </div>
    </EditorPage>
  );
}
