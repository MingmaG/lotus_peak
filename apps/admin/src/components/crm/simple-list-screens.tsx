'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPatch, query } from '@/lib/api-client';
import { formatDate, humanise, relativeTime } from '@/lib/format';

/** The two read-mostly CRM lists. Neither has an editor; both have a filter. */

function useListParams(route: string) {
  const router = useRouter();
  const params = useSearchParams();

  const setParams = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`${route}?${next.toString()}`, { scroll: false });
    },
    [params, router, route],
  );

  return {
    search: params.get('q') ?? '',
    status: params.get('status') ?? 'all',
    page: Number(params.get('page')) || 1,
    setParams,
  };
}

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export function NewsletterScreen({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const { search, status, page, setParams } = useListParams('/newsletter');

  const { data, isLoading } = useQuery<{
    items: Subscriber[];
    total: number;
    page: number;
    totalPages: number;
    counts: Record<string, number>;
  }>({
    queryKey: ['newsletter', { search, status, page }],
    queryFn: () => apiGet(`/api/newsletter${query({ q: search, status, page })}`),
  });

  const patch = useMutation({
    mutationFn: (body: { id: string; status: string }) => apiPatch('/api/newsletter', body),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['newsletter'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const counts = data?.counts ?? {};

  const columns: Column<Subscriber>[] = [
    {
      key: 'email',
      label: 'Address',
      primary: true,
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span>{row.email}</span>
          {row.name && (
            <span className="text-xs font-normal text-muted-foreground">{row.name}</span>
          )}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'From',
      hideBelow: 'lg',
      render: (row) => <span className="text-muted-foreground">{row.source ?? '—'}</span>,
    },
    {
      key: 'joined',
      label: 'Joined',
      hideBelow: 'md',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) =>
        canWrite ? (
          <Select
            value={row.status}
            onValueChange={(next) => patch.mutate({ id: row.id, status: next })}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Not confirmed</SelectItem>
              <SelectItem value="SUBSCRIBED">Subscribed</SelectItem>
              <SelectItem value="UNSUBSCRIBED">Unsubscribed</SelectItem>
              <SelectItem value="BOUNCED">Bouncing</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">{humanise(row.status)}</span>
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
          icon={Send}
          title="Nobody has subscribed yet"
          description="Addresses are confirmed by email before they count — a list of unconfirmed addresses is a list of typos and bots."
        />
      }
      search={search}
      onSearch={(value) => setParams({ q: value })}
      searchPlaceholder="Search by address…"
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            {
              value: 'PENDING',
              label: `Not confirmed${counts.PENDING ? ` (${counts.PENDING})` : ''}`,
            },
            {
              value: 'SUBSCRIBED',
              label: `Subscribed${counts.SUBSCRIBED ? ` (${counts.SUBSCRIBED})` : ''}`,
            },
            { value: 'UNSUBSCRIBED', label: 'Unsubscribed' },
            { value: 'BOUNCED', label: 'Bouncing' },
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

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
  _count: { enquiries: number; bookings: number };
}

/**
 * Everybody the office keeps a record of.
 *
 * Still not created automatically from an enquiry — two enquiries from one
 * address are often two people at the same organisation, and merging them
 * silently loses the distinction. What changed is that a booking has to be
 * invoiced to somebody, so these are now made *before* a booking as well as
 * after two enquiries turn out to be one person.
 *
 * Adding one is a page of its own (`/customers/new`), like editing one: the
 * record is twenty fields in four groups, and a sheet never had room for them.
 */
export function CustomersScreen({ canWrite }: { canWrite: boolean }) {
  const { search, page, setParams } = useListParams('/customers');

  const { data, isLoading } = useQuery<{
    items: Customer[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['customers', { search, page }],
    queryFn: () => apiGet(`/api/customers${query({ q: search, page })}`),
  });

  const columns: Column<Customer>[] = [
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
      key: 'country',
      label: 'Where',
      hideBelow: 'md',
      render: (row) => <span className="text-muted-foreground">{row.country ?? '—'}</span>,
    },
    {
      key: 'bookings',
      label: 'Bookings',
      align: 'right',
      render: (row) => <span className="tabular-nums">{row._count.bookings}</span>,
    },
    {
      key: 'enquiries',
      label: 'Enquiries',
      align: 'right',
      hideBelow: 'md',
      render: (row) => <span className="tabular-nums">{row._count.enquiries}</span>,
    },
    {
      key: 'since',
      label: 'Known since',
      align: 'right',
      hideBelow: 'lg',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {relativeTime(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        href={(row) => `/customers/${row.id}`}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="A customer is who a booking is invoiced to, and who several enquiries turn out to be. Neither is guessed from a matching address — both are somebody's judgement."
            action={
              canWrite ? (
                <Button size="sm" asChild>
                  <Link href="/customers/new">
                    <Plus className="mr-1.5 size-3.5" />
                    Add a customer
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
        search={search}
        onSearch={(value) => setParams({ q: value })}
        searchPlaceholder="Search by name, address or country…"
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPage={(next) => setParams({ page: next })}
        toolbar={
          canWrite && (data?.items.length ?? 0) > 0 ? (
            <div className="flex justify-end">
              <Button size="sm" asChild>
                <Link href="/customers/new">
                  <Plus className="mr-1.5 size-3.5" />
                  Add a customer
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />
    </>
  );
}
