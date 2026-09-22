import { ProfileForm } from '@/components/admin/profile-form';
import { PageHeader } from '@/components/shared/page-header';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      jobTitle: true,
      phone: true,
      role: { select: { name: true, description: true } },
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true, userAgent: true, ipAddress: true, lastSeenAt: true, createdAt: true },
      },
    },
  });

  if (!row) return null;

  return (
    <>
      <PageHeader title="Your account" description={row.email} />
      <ProfileForm
        initial={{
          name: row.name,
          email: row.email,
          jobTitle: row.jobTitle ?? '',
          phone: row.phone ?? '',
          roleName: row.role.name,
          roleDescription: row.role.description,
        }}
        sessions={row.sessions.map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          lastSeenAt: session.lastSeenAt.toISOString(),
        }))}
      />
    </>
  );
}
