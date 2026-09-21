import { AppShell } from '@/components/layout/app-shell';
import { requireUser } from '@/lib/auth/session';

/**
 * Every screen behind a login.
 *
 * `requireUser` here rather than in each page: the middleware has already
 * turned away a request with no token, and this is what turns the claims into
 * the object the shell renders the sidebar from. A page that needs more than
 * "signed in" calls `requirePermission` itself.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        roleSlug: user.roleSlug,
        permissions: user.permissions,
      }}
    >
      {children}
    </AppShell>
  );
}
