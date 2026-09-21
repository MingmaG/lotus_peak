'use client';

import { useQuery } from '@tanstack/react-query';
import { Mountain } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiGet, query } from '@/lib/api-client';
import { currency, humanise, relativeTime } from '@/lib/format';

interface TripRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  difficulty: string;
  durationDays: number;
  priceFromUsd: number;
  featured: boolean;
  regions: string[];
  updatedAt: string;
  _count: { itinerary: number; departures: number; enquiries: number };
}

interface Page {
  items: TripRow[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * The journeys list.
 *
 * Its state lives in the URL rather than in React, so a filtered view is a
 * link somebody can send — "the three that are still drafts" is a URL, and
 * pressing back after opening a journey returns to the same filter rather than
 * to the unfiltered list.
 *
 * The empty-state icon is imported here rather than passed in by the page. A
 * Lucide icon is a function component, and a function cannot cross the
 * server/client boundary as a prop — React refuses the whole render with
 * "Functions cannot be passed directly to Client Components", which names
 * neither the prop nor the component.
 */
export function TripsTable({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const search = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const type = params.get('type') ?? 'all';
  const page = Number(params.get('page')) || 1;
  const sort = params.get('sort') ?? 'order';
  const direction = (params.get('direction') as 'asc' | 'desc') ?? 'asc';

  const setParams = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      /* Any change but the page itself returns to page one. Otherwise
         searching from page three shows an empty page three. */
      if (!('page' in patch)) next.delete('page');
      router.replace(`/trips?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const { data, isLoading } = useQuery<Page>({
    queryKey: ['trips', { search, status, type, page, sort, direction }],
    queryFn: () =>
      apiGet<Page>(`/api/trips${query({ q: search, status, type, page, sort, direction })}`),
  });

  const columns: Column<TripRow>[] = [
    {
      key: 'title',
      label: 'Journey',
      primary: true,
      sortKey: 'title',
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span>{row.title}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {row.regions.join(' · ') || row.slug}
          </span>
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Kind',
      hideBelow: 'lg',
      render: (row) => (
        <Badge variant="secondary" className="font-normal">
          {humanise(row.type)}
        </Badge>
      ),
    },
    {
      key: 'length',
      label: 'Length',
      sortKey: 'duration',
      hideBelow: 'md',
      render: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {row.durationDays} days
          {row._count.itinerary !== row.durationDays && (
            /* The two disagreeing is worth seeing at a glance: an eleven-day
               journey with four days written is a page somebody left. */
            <span
              className="ml-1.5 text-xs text-status-attention"
              title={`${row._count.itinerary} day(s) written`}
            >
              ({row._count.itinerary})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'price',
      label: 'From',
      sortKey: 'price',
      align: 'right',
      hideBelow: 'md',
      render: (row) => <span className="tabular-nums">{currency(row.priceFromUsd)}</span>,
    },
    {
      key: 'enquiries',
      label: 'Enquiries',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">{row._count.enquiries}</span>
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
    {
      key: 'updated',
      label: 'Changed',
      sortKey: 'updatedAt',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {relativeTime(row.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={data?.items ?? []}
      columns={columns}
      rowKey={(row) => row.id}
      href={(row) => `/trips/${row.id}`}
      loading={isLoading}
      empty={
        <EmptyState
          icon={Mountain}
          title={search || status !== 'all' ? 'Nothing matches that' : 'No journeys yet'}
          description={
            search || status !== 'all'
              ? 'Try a different search, or clear the filters.'
              : 'A journey is a page on the site: a title, an itinerary, a price and the photographs that go with it.'
          }
          action={
            canWrite && !search && status === 'all' ? (
              <Button asChild>
                <Link href="/trips/new">Write the first one</Link>
              </Button>
            ) : undefined
          }
        />
      }
      search={search}
      onSearch={(value) => setParams({ q: value })}
      searchPlaceholder="Search journeys…"
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { value: 'DRAFT', label: 'Draft' },
            { value: 'SCHEDULED', label: 'Scheduled' },
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'ARCHIVED', label: 'Archived' },
          ],
        },
        {
          key: 'type',
          label: 'Kind',
          options: [
            { value: 'MINDFULNESS', label: 'Mindfulness' },
            { value: 'MEDITATION', label: 'Meditation' },
            { value: 'FESTIVAL', label: 'Festival' },
            { value: 'TREKKING', label: 'Trekking' },
          ],
        },
      ]}
      filterValues={{ status, type }}
      onFilter={(key, value) => setParams({ [key]: value })}
      page={data?.page ?? 1}
      totalPages={data?.totalPages ?? 1}
      total={data?.total ?? 0}
      onPage={(next) => setParams({ page: next })}
      sort={sort}
      direction={direction}
      onSort={(key) =>
        setParams({
          sort: key,
          direction: sort === key && direction === 'asc' ? 'desc' : 'asc',
        })
      }
    />
  );
}
