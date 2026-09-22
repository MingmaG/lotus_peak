'use client';

import { useMutation } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiClientError, apiPatch } from '@/lib/api-client';
import { relativeTime } from '@/lib/format';

export function ProfileForm({
  initial,
  sessions,
}: {
  initial: {
    name: string;
    email: string;
    jobTitle: string;
    phone: string;
    roleName: string;
    roleDescription: string | null;
  };
  sessions: {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    lastSeenAt: string;
  }[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: initial.name,
    jobTitle: initial.jobTitle,
    phone: initial.phone,
    currentPassword: '',
    newPassword: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      apiPatch<{ signedOut: boolean }>('/api/auth/change-password', {
        name: form.name,
        jobTitle: form.jobTitle || null,
        phone: form.phone || null,
        ...(form.newPassword
          ? { currentPassword: form.currentPassword, newPassword: form.newPassword }
          : {}),
      }),
    onSuccess: (result) => {
      setErrors({});
      setForm((current) => ({ ...current, currentPassword: '', newPassword: '' }));
      if (result.signedOut) {
        toast.success('Password changed. Sign in again.');
        router.push('/login');
        return;
      }
      toast.success('Saved');
      router.refresh();
    },
    onError: (error: Error) => {
      if (error instanceof ApiClientError && error.fields) setErrors(error.fields);
      toast.error(error.message);
    },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <Section title="You" description={initial.roleDescription ?? initial.roleName}>
        <Field label="Name">
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Email" hint="Only somebody with the Users screen can change this.">
          <Input value={initial.email} disabled />
        </Field>
        <Field label="What you do" hint="Shown beside a journal entry you wrote.">
          <Input
            value={form.jobTitle}
            onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
          />
        </Field>
        <Field label="Telephone">
          <Input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
      </Section>

      <Section
        title="Password"
        description="Changing it signs you out of every browser, including this one. That is the point: the usual reason to change a password is that somebody else may know it."
      >
        <Field label="Your current password" error={errors.currentPassword}>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
          />
        </Field>
        <Field
          label="New password"
          error={errors.newPassword}
          hint="Twelve characters at least. A phrase you can remember beats a word with symbols in it."
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
          />
        </Field>
      </Section>

      <Section
        title="Where you are signed in"
        description="Every browser with a live session. Changing your password ends all of them."
      >
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Only here.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {describe(session.userAgent)}
                  {session.ipAddress && ` · ${session.ipAddress}`}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(session.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Save className="mr-2 size-4" />
        )}
        Save
      </Button>
    </div>
  );
}

/**
 * A user-agent string, as something a person recognises.
 *
 * Deliberately crude — four substring checks. A proper parser is a dependency
 * and a table of regexes to keep current, for a line whose only job is to help
 * somebody notice a session that is not theirs.
 */
function describe(userAgent: string | null): string {
  if (!userAgent) return 'An unknown browser';
  if (userAgent.includes('iPhone')) return 'An iPhone';
  if (userAgent.includes('iPad')) return 'An iPad';
  if (userAgent.includes('Android')) return 'An Android device';
  if (userAgent.includes('Macintosh')) return 'A Mac';
  if (userAgent.includes('Windows')) return 'A Windows PC';
  return 'A browser';
}
