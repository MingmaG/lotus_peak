import { ReflectionsScreen } from '@/components/content/reflections-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata = { title: 'Reflections' };
export const dynamic = 'force-dynamic';

export default async function ReflectionsPage() {
  await requirePermission('reflections.read');
  const [canWrite, canDelete, trips] = await Promise.all([
    hasPermission('reflections.write'),
    hasPermission('reflections.delete'),
    db.trip.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true },
    }),
  ]);

  return <ReflectionsScreen canWrite={canWrite} canDelete={canDelete} trips={trips} />;
}
