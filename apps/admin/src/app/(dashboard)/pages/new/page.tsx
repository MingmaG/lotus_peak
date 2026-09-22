import { PageEditor } from '@/components/content/page-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { emptyPageForm } from '@/server/services/page-form';

export const metadata = { title: 'New page' };
export const dynamic = 'force-dynamic';

export default async function NewPagePage() {
  const user = await requirePermission('pages.write');

  const [trips, reflections, people, company] = await Promise.all([
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, title: true },
    }),
    db.reflection.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, quote: true },
    }),
    db.person.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    db.companyProfile.findFirst({ select: { siteUrl: true } }),
  ]);

  return (
    <PageEditor
      initial={emptyPageForm()}
      trips={trips}
      reflections={reflections}
      people={people}
      siteUrl={company?.siteUrl ?? 'https://lotuspeak.org'}
      canPublish={can(user.permissions, 'pages.publish')}
    />
  );
}
