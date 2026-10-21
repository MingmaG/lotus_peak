'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiGet, query } from '@/lib/api-client';
import { formatDate } from '@/lib/format';

interface Row {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  category: 'JOURNEYS' | 'TRAVEL_GUIDES' | 'EXPERIENCES' | 'STORIES';
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  featured: boolean;
  readingMinutes: number;
  publishedAt: string | null;
  author: { name: string } | null;
}

const SHELF: Record<Row['category'], string> = {
  JOURNEYS: 'Journeys',
  TRAVEL_GUIDES: 'Travel guides',
  EXPERIENCES: 'Experiences',
  STORIES: 'Stories',
};

export function PostsTable({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const search = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const page = Number(params.get('page')) || 1;

  const setParams = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/journal?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const { data, isLoading } = useQuery<{
    items: Row[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['posts', { search, status, page }],
    queryFn: () => apiGet(`/api/posts${query({ q: search, status, page, sort: 'publishedAt' })}`),
  });

  const columns: Column<Row>[] = [
    {
      key: 'title',
      label: 'Entry',
      primary: true,
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span>{row.title}</span>
          <span className="line-clamp-1 text-xs font-normal text-muted-foreground">
            {row.standfirst}
          </span>
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Shelf',
      hideBelow: 'md',
      render: (row) => <span className="text-muted-foreground">{SHELF[row.category]}</span>,
    },
    {
      key: 'author',
      label: 'Who',
      hideBelow: 'lg',
      render: (row) => (
        <span className="text-muted-foreground">{row.author?.name ?? 'Lotus Peak'}</span>
      ),
    },
    {
      key: 'length',
      label: 'Length',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
          {row.readingMinutes} min
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Dated',
      align: 'right',
      hideBelow: 'md',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.publishedAt)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          {row.featured && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              Featured
            </Badge>
          )}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={data?.items ?? []}
      columns={columns}
      rowKey={(row) => row.id}
      href={(row) => `/journal/${row.id}`}
      loading={isLoading}
      empty={
        <EmptyState
          icon={BookOpen}
          title={search ? 'Nothing matches that' : 'Nothing written yet'}
          description="Notes from the valleys — what you saw, and when it is worth coming to see it."
          action={
            canWrite && !search ? (
              <Button asChild>
                <Link href="/journal/new">Write the first entry</Link>
              </Button>
            ) : undefined
          }
        />
      }
      search={search}
      onSearch={(value) => setParams({ q: value })}
      searchPlaceholder="Search the journal…"
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'ARCHIVED', label: 'Archived' },
          ],
        },
      ]}
      filterValues={{ status }}
      onFilter={(key, value) => setParams({ [key]: value })}
      page={data?.page ?? 1}
      totalPages={data?.totalPages ?? 1}
      total={data?.total ?? 0}
      onPage={(next) => setParams({ page: next })}
    />
  );
}
