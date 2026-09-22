import { notFound } from 'next/navigation';

import { PageEditor } from '@/components/content/page-editor';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { pageFormData } from '@/server/services/page-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await db.page.findUnique({ where: { id }, select: { title: true } });
  return { title: page?.title ?? 'Page' };
}

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('pages.read');
  const { id } = await params;

  const [page, trips, reflections, people, company] = await Promise.all([
    pageFormData(id),
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

  if (!page) notFound();

  return (
    <PageEditor
      initial={page}
      trips={trips}
      reflections={reflections}
      people={people}
      siteUrl={company?.siteUrl ?? 'https://lotuspeak.org'}
      canPublish={can(user.permissions, 'pages.publish')}
    />
  );
}
