import { Plus } from 'lucide-react';
import Link from 'next/link';

import { PagesList } from '@/components/content/pages-list';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Pages' };
export const dynamic = 'force-dynamic';

export default async function PagesPage() {
  await requirePermission('pages.read');
  const canWrite = await hasPermission('pages.write');

  return (
    <>
      <PageHeader
        title="Pages"
        description="About, Contact, Terms, Travellers’ information — and the words around each index route, which used to be in the code."
        actions={
          canWrite && (
            <Button asChild>
              <Link href="/pages/new">
                <Plus className="mr-1.5 size-4" />
                New page
              </Link>
            </Button>
          )
        }
      />
      <PagesList />
    </>
  );
}
