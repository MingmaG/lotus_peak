import { Plus } from 'lucide-react';
import Link from 'next/link';

import { PostsTable } from '@/components/content/posts-table';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { hasPermission, requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Journal' };
export const dynamic = 'force-dynamic';

export default async function JournalPage() {
  await requirePermission('journal.read');
  const canWrite = await hasPermission('journal.write');

  return (
    <>
      <PageHeader
        title="Journal"
        description="Dated editorial, on four shelves: journeys, travel guides, experiences and stories. An entry can be about a place or a piece of culture — it links to those pages rather than describing them again."
        actions={
          canWrite && (
            <Button asChild>
              <Link href="/journal/new">
                <Plus className="mr-1.5 size-4" />
                New entry
              </Link>
            </Button>
          )
        }
      />
      <PostsTable canWrite={canWrite} />
    </>
  );
}
