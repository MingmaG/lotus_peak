'use client';

import { useQuery } from '@tanstack/react-query';
import { Percent, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { apiGet, query } from '@/lib/api-client';
import { formatDate, money } from '@/lib/format';

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  kind: string;
  value: number;
  currency: string;
  minSpendCents: number | null;
  maxDiscountCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxPerCustomer: number | null;
  redeemedCount: number;
  isActive: boolean;
  trips: { tripId: string; trip: { title: string } }[];
  _count: { redemptions: number };
}

/**
 * What a coupon takes off, in words.
 *
 * `value` means a percentage or an amount of cents depending on `kind`, which
 * is the one genuinely awkward thing in the schema — so it is turned into a
 * sentence here, once, rather than every table cell having to remember.
 */
function describes(row: CouponRow): string {
  const off =
    row.kind === 'PERCENTAGE' ? `${row.value}% off` : `${money(row.value, row.currency)} off`;
  const cap =
    row.kind === 'PERCENTAGE' && row.maxDiscountCents
      ? `, up to ${money(row.maxDiscountCents, row.currency)}`
      : '';
  const min = row.minSpendCents ? `, over ${money(row.minSpendCents, row.currency)}` : '';
  return `${off}${cap}${min}`;
}

/** Live, scheduled, finished or off — the same reading the API filters on. */
function stateOf(row: CouponRow): string {
  if (!row.isActive) return 'Off';
  const now = Date.now();
  if (row.startsAt && new Date(row.startsAt).getTime() > now) return 'Starts later';
  if (row.endsAt && new Date(row.endsAt).getTime() < now) return 'Finished';
  if (row.maxRedemptions != null && row.redeemedCount >= row.maxRedemptions) return 'Used up';
  return 'Live';
}

export function CouponsScreen({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  const set = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`/coupons?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const state = {
    search: params.get('q') ?? '',
    state: params.get('state') ?? 'all',
    page: Number(params.get('page')) || 1,
  };

  const { data, isLoading } = useQuery<{
    items: CouponRow[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['coupons', state],
    queryFn: () =>
      apiGet(`/api/coupons${query({ q: state.search, state: state.state, page: state.page })}`),
  });

  const columns: Column<CouponRow>[] = [
    {
      key: 'code',
      label: 'Code',
      primary: true,
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-mono text-sm">{row.code}</span>
          {row.description && (
            <span className="text-xs font-normal text-muted-foreground">{row.description}</span>
          )}
        </span>
      ),
    },
    {
      key: 'takes',
      label: 'Takes off',
      render: (row) => <span className="text-sm">{describes(row)}</span>,
    },
    {
      key: 'journeys',
      label: 'Journeys',
      hideBelow: 'lg',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.trips.length === 0
            ? 'All of them'
            : row.trips.map((one) => one.trip.title).join(', ')}
        </span>
      ),
    },
    {
      key: 'when',
      label: 'When',
      hideBelow: 'md',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {row.startsAt || row.endsAt
            ? `${row.startsAt ? formatDate(row.startsAt) : 'now'} – ${row.endsAt ? formatDate(row.endsAt) : 'no end'}`
            : 'Always'}
        </span>
      ),
    },
    {
      key: 'used',
      label: 'Used',
      align: 'right',
      render: (row) => (
        <span className="flex flex-col items-end gap-0.5">
          <span className="text-sm tabular-nums">
            {row.redeemedCount}
            {row.maxRedemptions != null ? ` of ${row.maxRedemptions}` : ''}
          </span>
          <span className="text-xs text-muted-foreground">{stateOf(row)}</span>
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={data?.items ?? []}
      columns={columns}
      rowKey={(row) => row.id}
      href={(row) => `/coupons/${row.id}`}
      loading={isLoading}
      empty={
        <EmptyState
          icon={Percent}
          title="No coupons"
          description="A code, what it takes off, and the rules about who may use it. Applied on the booking form; nothing on the website reads these."
          action={
            canWrite ? (
              <Button size="sm" asChild>
                <Link href="/coupons/new">
                  <Plus className="mr-1.5 size-3.5" />
                  Make a coupon
                </Link>
              </Button>
            ) : undefined
          }
        />
      }
      search={state.search}
      onSearch={(value) => set({ q: value })}
      searchPlaceholder="Search by code…"
      filters={[
        {
          key: 'state',
          label: 'State',
          options: [
            { value: 'live', label: 'Live now' },
            { value: 'scheduled', label: 'Starts later' },
            { value: 'finished', label: 'Finished' },
            { value: 'off', label: 'Switched off' },
          ],
        },
      ]}
      filterValues={{ state: state.state }}
      onFilter={(key, value) => set({ [key]: value })}
      page={data?.page ?? 1}
      totalPages={data?.totalPages ?? 1}
      total={data?.total ?? 0}
      onPage={(next) => set({ page: next })}
      toolbar={
        canWrite && (data?.items.length ?? 0) > 0 ? (
          <div className="flex justify-end">
            <Button size="sm" asChild>
              <Link href="/coupons/new">
                <Plus className="mr-1.5 size-3.5" />
                Make a coupon
              </Link>
            </Button>
          </div>
        ) : undefined
      }
    />
  );
}
