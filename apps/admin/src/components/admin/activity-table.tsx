'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { apiGet, query } from '@/lib/api-client';
import { formatDateTime, humanise, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

const ACTION_TONE: Record<string, string> = {
  DELETE: 'text-destructive',
  PUBLISH: 'text-status-published',
  UNPUBLISH: 'text-status-attention',
};

/**
 * Who changed what.
 *
 * The `after` column shows the fields that moved rather than the whole row —
 * that is what the log stores, and it is what makes a row readable: "status:
 * PUBLISHED" tells somebody what happened, and a four-kilobyte snapshot of a
 * journey does not.
 */
export function ActivityTable({ users }: { users: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const search = params.get('q') ?? '';
  const entity = params.get('entity') ?? 'all';
  const user = params.get('user') ?? 'all';
  const page = Number(params.get('page')) || 1;

  const setParams = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/activity?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const { data, isLoading } = useQuery<{
    items: Row[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['activity', { search, entity, user, page }],
    queryFn: () => apiGet(`/api/activity${query({ q: search, entity, user, page })}`),
  });

  const columns: Column<Row>[] = [
    {
      key: 'what',
      label: 'What',
      primary: true,
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span>
            <span className={cn('font-medium', ACTION_TONE[row.action])}>
              {humanise(row.action)}
            </span>{' '}
            <span className="text-muted-foreground">{row.entity}</span>
          </span>
          {row.entityLabel && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {row.entityLabel}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'who',
      label: 'Who',
      hideBelow: 'md',
      render: (row) => (
        <span className="text-muted-foreground">{row.user?.name ?? 'The system'}</span>
      ),
    },
    {
      key: 'changed',
      label: 'What changed',
      hideBelow: 'lg',
      render: (row) => {
        const keys = Object.keys(row.after ?? {});
        if (keys.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className="truncate text-xs text-muted-foreground"
            title={keys.map((key) => `${key}: ${JSON.stringify(row.after?.[key])}`).join('\n')}
          >
            {keys.slice(0, 3).join(', ')}
            {keys.length > 3 && ` +${keys.length - 3}`}
          </span>
        );
      },
    },
    {
      key: 'when',
      label: 'When',
      align: 'right',
      render: (row) => (
        <span
          className="whitespace-nowrap text-xs text-muted-foreground"
          title={formatDateTime(row.createdAt)}
        >
          {relativeTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={data?.items ?? []}
      columns={columns}
      rowKey={(row) => row.id}
      loading={isLoading}
      empty={
        <EmptyState
          icon={Activity}
          title="Nothing recorded yet"
          description="Every save, publish, delete and sign-in is written here, with who did it."
        />
      }
      search={search}
      onSearch={(value) => setParams({ q: value })}
      searchPlaceholder="Search by what was changed…"
      filters={[
        {
          key: 'entity',
          label: 'Kind',
          options: [
            'trip',
            'post',
            'page',
            'destination',
            'activity',
            'culture',
            'gallery',
            'reflection',
            'media',
            'enquiry',
            'company',
            'menu',
            'user',
            'session',
          ].map((value) => ({ value, label: humanise(value) })),
        },
        {
          key: 'user',
          label: 'Who',
          options: users.map((one) => ({ value: one.id, label: one.name })),
        },
      ]}
      filterValues={{ entity, user }}
      onFilter={(key, value) => setParams({ [key]: value })}
      page={data?.page ?? 1}
      totalPages={data?.totalPages ?? 1}
      total={data?.total ?? 0}
      onPage={(next) => setParams({ page: next })}
    />
  );
}
