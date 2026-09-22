import { CultureScreen } from '@/components/content/culture-screen';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'New · Culture' };
export const dynamic = 'force-dynamic';

export default async function NewCulturePage() {
  await requirePermission('culture.read');
  const [canWrite, canDelete] = await Promise.all([
    hasPermission('culture.write'),
    hasPermission('culture.delete'),
  ]);

  return <CultureScreen canWrite={canWrite} canDelete={canDelete} editId={null} />;
}
