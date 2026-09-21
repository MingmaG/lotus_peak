import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/layout/login-form';
import { currentUser, hasRefreshCookie } from '@/lib/auth/session';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

/**
 * The login screen, which first tries not to be one.
 *
 * A person whose access token expired overnight still holds a valid refresh
 * cookie. Showing them a password form would be asking them to prove something
 * they have already proved.
 *
 * The exchange itself cannot happen here — a Server Component may not write a
 * cookie — so this page only reports whether there is a refresh cookie worth
 * trying, and `LoginForm` makes the request to `/api/auth/refresh`, which is a
 * route handler and may set one. What the person sees is the same: a moment of
 * "Signing you in", then the page they asked for.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);

  if (await currentUser()) redirect(destination);

  return <LoginForm next={destination} mayResume={await hasRefreshCookie()} />;
}

/**
 * Only a path on this origin.
 *
 * `?next=https://example.com` would otherwise make the login form an open
 * redirect — the classic way a phishing link borrows a real domain's
 * credibility.
 */
function safeNext(next: string | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}
