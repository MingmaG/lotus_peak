'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign } from 'lucide-react';
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
import { formatDate, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PaymentStatusBadge } from './badges';
import { PAYMENT_KIND, PAYMENT_METHOD } from './labels';

interface PaymentRow {
  id: string;
  reference: string;
  direction: string;
  kind: string;
  status: string;
  method: string;
  amountCents: number;
  currency: string;
  feeCents: number;
  providerRef: string | null;
  paidAt: string;
  notes: string | null;
  booking: {
    id: string;
    reference: string;
    currency: string;
    customer: { id: string; name: string } | null;
    trip: { id: string; title: string } | null;
  };
  recordedBy: { id: string; name: string } | null;
}

interface Response {
  items: PaymentRow[];
  total: number;
  page: number;
  totalPages: number;
  totals: {
    receivedCents: number;
    refundedCents: number;
    netCents: number;
    feesCents: number;
    pendingCents: number;
    pendingCount: number;
  };
}

/**
 * The ledger.
 *
 * Every transaction across every booking, which is the same data the booking's
 * own screen shows and a different question: this one is opened with a bank
 * statement beside it. That is why the reference, the provider's reference and
 * the date are the prominent columns, and why a payment cannot be created from
 * here — money is recorded against a booking, and a payment with no booking is
 * a row nobody can reconcile.
 */
export function PaymentsScreen({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();

  const set = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/payments?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const state = {
    search: params.get('q') ?? '',
    status: params.get('status') ?? 'all',
    method: params.get('method') ?? 'all',
    direction: params.get('direction') ?? 'all',
    kind: params.get('kind') ?? 'all',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    page: Number(params.get('page')) || 1,
  };

  const { data, isLoading } = useQuery<Response>({
    queryKey: ['payments', state],
    queryFn: () =>
      apiGet(
        `/api/payments${query({
          q: state.search,
          status: state.status,
          method: state.method,
          direction: state.direction,
          kind: state.kind,
          from: state.from,
          to: state.to,
          page: state.page,
        })}`,
      ),
  });

  const clear = useMutation({
    mutationFn: (row: { id: string; status: string }) =>
      apiPatch(`/api/payments/${row.id}`, { status: row.status }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['payments'] });
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({ queryKey: ['booking'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const columns: Column<PaymentRow>[] = [
    {
      key: 'reference',
      label: 'Payment',
      primary: true,
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-mono text-xs">{row.reference}</span>
          <span className="text-xs text-muted-foreground">
            {PAYMENT_KIND[row.kind] ?? row.kind} · {PAYMENT_METHOD[row.method] ?? row.method}
          </span>
        </span>
      ),
    },
    {
      key: 'booking',
      label: 'Against',
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <Link
            href={`/bookings/${row.booking.id}`}
            className="text-sm hover:text-primary hover:underline"
          >
            {row.booking.customer?.name ?? row.booking.reference}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {row.booking.reference}
          </span>
        </span>
      ),
    },
    {
      key: 'paidAt',
      label: 'On',
      hideBelow: 'md',
      sortKey: 'paidAt',
      render: (row) => (
        <span className="flex flex-col gap-0.5 whitespace-nowrap text-xs text-muted-foreground">
          <span>{formatDate(row.paidAt)}</span>
          {row.providerRef && <span className="font-mono">{row.providerRef}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'State',
      render: (row) =>
        canWrite && (row.status === 'PENDING' || row.status === 'COMPLETED') ? (
          <Select
            value={row.status}
            onValueChange={(status) => clear.mutate({ id: row.id, status })}
          >
            <SelectTrigger className="h-8 w-32 text-xs" aria-label="Payment state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Expected</SelectItem>
              <SelectItem value="COMPLETED">Cleared</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="CANCELLED">Voided</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <PaymentStatusBadge status={row.status} />
        ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortKey: 'amountCents',
      render: (row) => (
        <span className="flex flex-col items-end gap-0.5">
          <span
            className={cn(
              'tabular-nums',
              row.direction === 'OUT' && 'text-status-attention',
              row.status !== 'COMPLETED' && 'text-muted-foreground',
            )}
          >
            {row.direction === 'OUT' ? '−' : '+'}
            {money(row.amountCents, row.currency)}
          </span>
          {row.feeCents > 0 && (
            <span className="text-xs text-muted-foreground">
              {money(row.feeCents, row.currency)} fee
            </span>
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
      loading={isLoading}
      empty={
        <EmptyState
          icon={CircleDollarSign}
          title="No payments yet"
          description="Money is recorded against a booking, so this fills up as bookings are paid. Open a booking to record one."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/bookings">Go to bookings</Link>
            </Button>
          }
        />
      }
      search={state.search}
      onSearch={(value) => set({ q: value })}
      searchPlaceholder="Reference, bank reference, name…"
      filters={[
        {
          key: 'status',
          label: 'State',
          options: [
            { value: 'COMPLETED', label: 'Cleared' },
            { value: 'PENDING', label: 'Expected' },
            { value: 'FAILED', label: 'Failed' },
            { value: 'CANCELLED', label: 'Voided' },
          ],
        },
        {
          key: 'direction',
          label: 'Way',
          options: [
            { value: 'IN', label: 'Received' },
            { value: 'OUT', label: 'Refunded' },
          ],
        },
        {
          key: 'method',
          label: 'How',
          options: Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label })),
        },
      ]}
      filterValues={{ status: state.status, direction: state.direction, method: state.method }}
      onFilter={(key, value) => set({ [key]: value })}
      page={data?.page ?? 1}
      totalPages={data?.totalPages ?? 1}
      total={data?.total ?? 0}
      onPage={(next) => set({ page: next })}
      toolbar={
        <div className="space-y-3">
          {/**
           * A date range, spelled out rather than offered as "this month".
           *
           * A bank statement covers a period with edges the bank chose, and a
           * preset that is a day out is a reconciliation that does not balance
           * for a reason nobody can see.
           */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Paid from
              <input
                type="date"
                value={state.from}
                onChange={(event) => set({ from: event.target.value })}
                className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              to
              <input
                type="date"
                value={state.to}
                onChange={(event) => set({ to: event.target.value })}
                className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
              />
            </label>
            {(state.from || state.to) && (
              <Button variant="ghost" size="sm" onClick={() => set({ from: null, to: null })}>
                Clear the dates
              </Button>
            )}
          </div>

          {data && data.total > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3">
              <div>
                <dt className="text-xs text-muted-foreground">Received</dt>
                <dd className="text-sm tabular-nums">{money(data.totals.receivedCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Refunded</dt>
                <dd className="text-sm tabular-nums">{money(data.totals.refundedCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Net</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {money(data.totals.netCents)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Bank fees</dt>
                <dd className="text-sm tabular-nums">{money(data.totals.feesCents)}</dd>
              </div>
              {data.totals.pendingCount > 0 && (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Expected ({data.totals.pendingCount})
                  </dt>
                  <dd className="text-sm tabular-nums text-status-scheduled">
                    {money(data.totals.pendingCents)}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      }
    />
  );
}
