import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/layout/login-form';
import { currentUser, refresh } from '@/lib/auth/session';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

/**
 * The login screen, which first tries not to be one.
 *
 * A person whose access token expired overnight still holds a valid refresh
 * cookie. Showing them a password form would be asking them to prove something
 * they have already proved, so the refresh is attempted here and a success
 * puts them back where they were going.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);

  if (await currentUser()) redirect(destination);
  if (await refresh()) redirect(destination);

  return <LoginForm next={destination} />;
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
