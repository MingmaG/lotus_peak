'use client';

import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { apiGet, query } from '@/lib/api-client';
import { humanise, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  kind: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
  enquiry: { id: string; reference: string } | null;
}

const TONE: Record<string, string> = {
  FAILED: 'text-destructive',
  BOUNCED: 'text-destructive',
  COMPLAINED: 'text-destructive',
  QUEUED: 'text-muted-foreground',
  SENT: 'text-status-published',
  DELIVERED: 'text-status-published',
  OPENED: 'text-status-published',
};

export function EmailsScreen({ mailConfigured }: { mailConfigured: boolean }) {
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
      router.replace(`/emails?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const { data, isLoading } = useQuery<{
    items: Row[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['emails', { search, status, page }],
    queryFn: () => apiGet(`/api/emails${query({ q: search, status, page })}`),
  });

  const columns: Column<Row>[] = [
    {
      key: 'subject',
      label: 'Message',
      primary: true,
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span>{row.subject}</span>
          <span className="text-xs font-normal text-muted-foreground">
            to {row.toName ? `${row.toName} <${row.toEmail}>` : row.toEmail}
          </span>
        </span>
      ),
    },
    {
      key: 'kind',
      label: 'Kind',
      hideBelow: 'lg',
      render: (row) => <span className="text-muted-foreground">{humanise(row.kind)}</span>,
    },
    {
      key: 'enquiry',
      label: 'About',
      hideBelow: 'lg',
      render: (row) =>
        row.enquiry ? (
          <a href={`/enquiries/${row.enquiry.id}`} className="font-mono text-xs hover:underline">
            {row.enquiry.reference}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={cn('text-xs', TONE[row.status] ?? 'text-muted-foreground')}>
          {humanise(row.status)}
          {row.error && (
            <span className="mt-0.5 block max-w-60 truncate" title={row.error}>
              {row.error}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'when',
      label: 'When',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {relativeTime(row.sentAt ?? row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {!mailConfigured && (
        <div className="rounded-lg border border-status-attention/40 bg-status-attention/5 p-4 text-sm">
          <p className="font-medium">Nothing is actually being sent.</p>
          <p className="mt-1 text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5 text-xs">RESEND_API_KEY</code> is not
            set, so every message below was written, recorded and logged rather than delivered.
            That is the right default for a database full of test addresses — and it means the
            wording can be checked before a key is ever added.
          </p>
        </div>
      )}

      <DataTable
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Mail}
            title="Nothing sent yet"
            description="Every message this site produces is recorded here, exactly as it went out."
          />
        }
        search={search}
        onSearch={(value) => setParams({ q: value })}
        searchPlaceholder="Search by address or subject…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: ['QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'BOUNCED', 'FAILED'].map(
              (value) => ({ value, label: humanise(value) }),
            ),
          },
        ]}
        filterValues={{ status }}
        onFilter={(key, value) => setParams({ [key]: value })}
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPage={(next) => setParams({ page: next })}
      />
    </div>
  );
}
