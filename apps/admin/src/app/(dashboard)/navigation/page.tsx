import { NavigationScreen } from '@/components/content/navigation-screen';
import { PageHeader } from '@/components/shared/page-header';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Navigation' };
export const dynamic = 'force-dynamic';

export default async function NavigationPage() {
  await requirePermission('navigation.write');
  const canWrite = await hasPermission('navigation.write');

  /**
   * Every address that currently resolves.
   *
   * Used to warn about a link to nothing — a warning rather than a refusal,
   * because the office links to anchors and to pages that are drafts today.
   */
  const [pages, trips, posts] = await Promise.all([
    db.page.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, select: { path: true } }),
    db.trip.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, select: { slug: true } }),
    db.post.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, select: { slug: true } }),
  ]);

  const knownPaths = [
    ...pages.map((row) => row.path),
    ...trips.map((row) => `/trips/${row.slug}`),
    ...posts.map((row) => `/journal/${row.slug}`),
  ];

  return (
    <>
      <PageHeader
        title="Navigation"
        description="The links across the top and the three columns in the footer. Drag to reorder."
      />
      <NavigationScreen canWrite={canWrite} knownPaths={knownPaths} />
    </>
  );
}
