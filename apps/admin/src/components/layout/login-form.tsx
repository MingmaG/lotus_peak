'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiPost } from '@/lib/api-client';

export function LoginForm({
  next,
  /** A refresh cookie was present, so this may not need to be a form at all. */
  mayResume = false,
}: {
  next: string;
  mayResume?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resuming, setResuming] = React.useState(mayResume);

  /**
   * Try the refresh cookie before asking for a password.
   *
   * This runs here rather than on the server because it *writes* a cookie, and
   * only a route handler may. Until it answers the form is not rendered, so a
   * person coming back to a tab that sat open overnight sees one quiet line
   * and then the page they wanted — not a sign-in form that vanishes as they
   * reach for it.
   */
  React.useEffect(() => {
    if (!mayResume) return;
    let cancelled = false;

    void fetch('/api/auth/refresh', { method: 'POST' })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          /* The cookie was stale or revoked. The form is the right answer. */
          setResuming(false);
          return;
        }
        router.replace(next);
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) setResuming(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mayResume, next, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(event.currentTarget);
    try {
      await apiPost('/api/auth/login', {
        email: String(data.get('email') ?? ''),
        password: String(data.get('password') ?? ''),
      });
      router.push(next);
      /* Without this the shell renders from the cache it had while signed
         out, which is a sidebar with no navigation in it. */
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : 'Could not reach the server. Check your connection and try again.',
      );
      setPending(false);
    }
  }

  if (resuming) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Lotus Peak
        </p>
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Signing you in
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Lotus Peak
        </p>
        <h1 className="mt-2 text-xl font-normal">Sign in</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </div>
  );
}
