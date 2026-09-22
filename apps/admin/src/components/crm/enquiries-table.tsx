'use client';

import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { apiGet, query } from '@/lib/api-client';
import { humanise, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  reference: string;
  name: string;
  email: string;
  country: string | null;
  preferredDates: string | null;
  travellers: string | null;
  status: string;
  priority: string;
  source: string;
  createdAt: string;
  trip: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
  _count: { notes: number; messages: number };
}

/**
 * How a status reads at a glance.
 *
 * NEW is the only one that draws attention, because it is the only one that
 * means somebody has to do something. Colouring all seven would be a table
 * where nothing stands out.
 */
const STATUS_TONE: Record<string, string> = {
  NEW: 'bg-primary/15 text-primary',
  READ: 'bg-muted text-muted-foreground',
  REPLIED: 'bg-muted text-muted-foreground',
  QUOTED: 'bg-muted text-muted-foreground',
  CONVERTED: 'bg-status-published/15 text-status-published',
  CLOSED: 'bg-muted text-muted-foreground',
  SPAM: 'bg-destructive/10 text-destructive',
};

export function EnquiriesTable({
  users,
  trips,
}: {
  users: { id: string; name: string }[];
  trips: { id: string; title: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const search = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const assignee = params.get('assignee') ?? 'all';
  const trip = params.get('trip') ?? 'all';
  const page = Number(params.get('page')) || 1;

  const setParams = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/enquiries?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const { data, isLoading } = useQuery<{
    items: Row[];
    total: number;
    page: number;
    totalPages: number;
    counts: Record<string, number>;
  }>({
    queryKey: ['enquiries', { search, status, assignee, trip, page }],
    queryFn: () => apiGet(`/api/enquiries${query({ q: search, status, assignee, trip, page })}`),
    /* Somebody watching this screen should see a new enquiry arrive. */
    refetchInterval: 60_000,
  });

  const columns: Column<Row>[] = [
    {
      key: 'name',
      label: 'Who',
      primary: true,
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span>{row.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{row.email}</span>
        </span>
      ),
    },
    {
      key: 'reference',
      label: 'Ref',
      hideBelow: 'lg',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.reference}</span>
      ),
    },
    {
      key: 'trip',
      label: 'About',
      hideBelow: 'md',
      render: (row) => (
        <span className="text-muted-foreground">
          {row.trip?.title ?? <span className="italic">Not yet chosen</span>}
        </span>
      ),
    },
    {
      key: 'when',
      label: 'When',
      hideBelow: 'lg',
      render: (row) => <span className="text-muted-foreground">{row.preferredDates ?? '—'}</span>,
    },
    {
      key: 'assignee',
      label: 'With',
      hideBelow: 'lg',
      render: (row) =>
        row.assignee ? (
          <span className="text-muted-foreground">{row.assignee.name}</span>
        ) : (
          <span className="text-xs italic text-muted-foreground">Nobody</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] font-medium',
              STATUS_TONE[row.status] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {humanise(row.status)}
          </span>
          {row.priority === 'HIGH' && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              High
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'age',
      label: 'Arrived',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {relativeTime(row.createdAt)}
        </span>
      ),
    },
  ];

  const counts = data?.counts ?? {};

  return (
    <DataTable
      rows={data?.items ?? []}
      columns={columns}
      rowKey={(row) => row.id}
      href={(row) => `/enquiries/${row.id}`}
      loading={isLoading}
      empty={
        <EmptyState
          icon={Inbox}
          title={search || status !== 'all' ? 'Nothing matches that' : 'No enquiries yet'}
          description="The contact form, the journey pages and the enquiry drawer all write here."
        />
      }
      search={search}
      onSearch={(value) => setParams({ q: value })}
      searchPlaceholder="Search by name, email, reference or message…"
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { value: 'NEW', label: `Unread${counts.NEW ? ` (${counts.NEW})` : ''}` },
            { value: 'READ', label: 'Read' },
            { value: 'REPLIED', label: 'Replied' },
            { value: 'QUOTED', label: 'Quoted' },
            { value: 'CONVERTED', label: 'Converted' },
            { value: 'CLOSED', label: 'Closed' },
            { value: 'SPAM', label: 'Spam' },
          ],
        },
        {
          key: 'assignee',
          label: 'With',
          options: [
            { value: 'nobody', label: 'Nobody' },
            ...users.map((user) => ({ value: user.id, label: user.name })),
          ],
        },
        {
          key: 'trip',
          label: 'Journey',
          options: trips.map((one) => ({ value: one.id, label: one.title })),
        },
      ]}
      filterValues={{ status, assignee, trip }}
      onFilter={(key, value) => setParams({ [key]: value })}
      page={data?.page ?? 1}
      totalPages={data?.totalPages ?? 1}
      total={data?.total ?? 0}
      onPage={(next) => setParams({ page: next })}
    />
  );
}
