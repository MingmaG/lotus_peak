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
  /* Amber, not grey: nothing was attempted and nobody was told. */
  SKIPPED: 'text-status-attention',
  QUEUED: 'text-muted-foreground',
  PROCESSING: 'text-muted-foreground',
  SENT: 'text-status-published',
  DELIVERED: 'text-status-published',
  OPENED: 'text-status-published',
  CLICKED: 'text-status-published',
};

/**
 * What a status means, where the word alone does not carry it.
 *
 * "Sent" and "Delivered" look like synonyms and are not: the first is the
 * provider accepting the message, the second is it reaching a mailbox. The
 * distinction is the reason the webhook exists, so it is worth a tooltip.
 */
const MEANING: Record<string, string> = {
  QUEUED: 'Written down. Nothing has been attempted — usually because no sending key is set.',
  PROCESSING: 'Handed to Resend, no answer yet. A message that stays here means the send did not finish.',
  SENT: 'Resend accepted it. That is not the same as it having arrived.',
  DELIVERED: 'Resend says it reached the mailbox.',
  OPENED: 'Opened by the recipient.',
  CLICKED: 'A link in it was followed.',
  BOUNCED: 'The mailbox refused it. The address is probably wrong.',
  COMPLAINED: 'Marked as spam by the recipient.',
  FAILED: 'The send itself failed. The reason is below.',
  SKIPPED: 'Never attempted — the day’s sending allowance was already spent. Write to this person by hand.',
};

export function EmailsScreen({ recordingConfigured }: { recordingConfigured: boolean }) {
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
        <span
          className={cn('text-xs', TONE[row.status] ?? 'text-muted-foreground')}
          title={MEANING[row.status]}
        >
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
      {!recordingConfigured && (
        <div className="rounded-lg border border-status-attention/40 bg-status-attention/5 p-4 text-sm">
          <p className="font-medium">This list cannot fill up.</p>
          <p className="mt-1 text-muted-foreground">
            The website sends an enquiry’s email — that is deliberate, so a traveller still
            reaches you on a day this panel is down — and then reports each message here. Without{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">MAIL_REPORT_SECRET</code> set on
            both, that report is refused: mail is going out and none of it is written down.
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
            options: [
              'QUEUED',
              'PROCESSING',
              'SENT',
              'DELIVERED',
              'OPENED',
              'BOUNCED',
              'COMPLAINED',
              'FAILED',
              'SKIPPED',
            ].map((value) => ({ value, label: humanise(value) })),
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
