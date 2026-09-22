'use client';

import { useQuery } from '@tanstack/react-query';
import { BookMarked, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { apiGet, query } from '@/lib/api-client';
import { balanceCents, paymentState } from '@/lib/booking-money';
import { formatDate, money } from '@/lib/format';
import { BookingStatusBadge, PaymentStateBadge } from './badges';
import { BOOKING_KIND_SHORT, partyLabel } from './labels';

export interface BookingRow {
  id: string;
  reference: string;
  kind: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  adults: number;
  children: number;
  currency: string;
  totalCents: number;
  netPaidCents: number;
  refundedCents: number;
  createdAt: string;
  trip: { id: string; title: string } | null;
  customer: { id: string; name: string; email: string };
  assignee: { id: string; name: string } | null;
  departure: { id: string; startDate: string } | null;
  _count: { travellers: number; payments: number };
}

interface Response {
  items: BookingRow[];
  total: number;
  page: number;
  totalPages: number;
  counts: Record<string, number>;
  totals: { totalCents: number; paidCents: number; outstandingCents: number };
}

/**
 * Every booking.
 *
 * The filters are in the URL rather than in component state, so that a filtered
 * list is a link. "The four unpaid Jomolhari bookings in April" is a thing one
 * person in this office sends another, and a screen whose state lives in React
 * cannot be sent.
 */
function useParams() {
  const router = useRouter();
  const params = useSearchParams();

  const set = React.useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, String(value));
      }
      /* Any change but the page itself goes back to page one. Filtering to
         three results while on page four shows an empty table, and the office
         reads that as "there are none". */
      if (!('page' in patch)) next.delete('page');
      router.replace(`/bookings?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  return {
    search: params.get('q') ?? '',
    status: params.get('status') ?? 'all',
    kind: params.get('kind') ?? 'all',
    trip: params.get('trip') ?? 'all',
    payment: params.get('payment') ?? 'all',
    party: params.get('party') ?? 'all',
    sort: params.get('sort') ?? 'createdAt',
    direction: (params.get('direction') as 'asc' | 'desc') ?? 'desc',
    page: Number(params.get('page')) || 1,
    set,
  };
}

export function BookingsTable({
  trips,
  canWrite,
}: {
  trips: { id: string; title: string }[];
  canWrite: boolean;
}) {
  const p = useParams();

  const { data, isLoading } = useQuery<Response>({
    queryKey: [
      'bookings',
      { q: p.search, status: p.status, kind: p.kind, trip: p.trip, payment: p.payment, party: p.party, sort: p.sort, direction: p.direction, page: p.page },
    ],
    queryFn: () =>
      apiGet(
        `/api/bookings${query({
          q: p.search,
          status: p.status,
          kind: p.kind,
          trip: p.trip,
          payment: p.payment,
          party: p.party,
          sort: p.sort,
          direction: p.direction,
          page: p.page,
        })}`,
      ),
  });

  const counts = data?.counts ?? {};

  const columns: Column<BookingRow>[] = [
    {
      key: 'reference',
      label: 'Booking',
      primary: true,
      sortKey: 'reference',
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-mono text-xs">{row.reference}</span>
          <span className="text-sm font-medium">{row.customer.name}</span>
        </span>
      ),
    },
    {
      key: 'journey',
      label: 'Journey',
      hideBelow: 'md',
      render: (row) => (
        <span className="flex flex-col gap-0.5">
          <span>{row.trip?.title ?? 'Not yet chosen'}</span>
          <span className="text-xs text-muted-foreground">
            {BOOKING_KIND_SHORT[row.kind] ?? row.kind} · {partyLabel(row.adults, row.children)}
          </span>
        </span>
      ),
    },
    {
      key: 'when',
      label: 'When',
      hideBelow: 'lg',
      sortKey: 'startDate',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {row.startDate ? formatDate(row.startDate) : 'Dates to agree'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <BookingStatusBadge status={row.status} />,
    },
    {
      key: 'money',
      label: 'Money',
      align: 'right',
      sortKey: 'totalCents',
      render: (row) => {
        const owed = balanceCents(row);
        return (
          <span className="flex flex-col items-end gap-0.5">
            <span className="tabular-nums">{money(row.totalCents, row.currency)}</span>
            {/* The outstanding figure, and only when there is one. A column
                that says "$0.00 outstanding" on every settled booking is a
                column that hides the four that are not. */}
            {owed > 0 ? (
              <span className="text-xs tabular-nums text-status-attention">
                {money(owed, row.currency)} owing
              </span>
            ) : (
              <PaymentStateBadge state={paymentState(row)} className="text-muted-foreground" />
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <DataTable
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        href={(row) => `/bookings/${row.id}`}
        loading={isLoading}
        empty={
          <EmptyState
            icon={BookMarked}
            title="No bookings yet"
            description="A booking is a journey somebody has committed to — who is coming, what it costs, and what they have paid."
            action={
              canWrite ? (
                <Button asChild size="sm">
                  <Link href="/bookings/new">
                    <Plus className="mr-1.5 size-3.5" />
                    Take a booking
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
        search={p.search}
        onSearch={(value) => p.set({ q: value })}
        searchPlaceholder="Reference, name, email or traveller…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'DRAFT', label: `Draft${counts.DRAFT ? ` (${counts.DRAFT})` : ''}` },
              {
                value: 'PROVISIONAL',
                label: `Held${counts.PROVISIONAL ? ` (${counts.PROVISIONAL})` : ''}`,
              },
              {
                value: 'CONFIRMED',
                label: `Confirmed${counts.CONFIRMED ? ` (${counts.CONFIRMED})` : ''}`,
              },
              { value: 'COMPLETED', label: 'Travelled' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
          {
            key: 'payment',
            label: 'Money',
            options: [
              /* First, because it is what somebody opens this screen for. */
              { value: 'owing', label: 'Still owing' },
              { value: 'unpaid', label: 'Nothing paid' },
              { value: 'part', label: 'Part paid' },
              { value: 'paid', label: 'Paid in full' },
            ],
          },
          {
            key: 'kind',
            label: 'Kind',
            options: [
              { value: 'FIXED_DEPARTURE', label: 'On a fixed departure' },
              { value: 'PRIVATE', label: 'Private' },
              { value: 'CUSTOM', label: 'Made to order' },
            ],
          },
          {
            key: 'party',
            label: 'Party',
            options: [
              { value: 'solo', label: 'Solo travellers' },
              { value: 'group', label: 'Two or more' },
            ],
          },
          {
            key: 'trip',
            label: 'Journey',
            options: trips.map((trip) => ({ value: trip.id, label: trip.title })),
          },
        ]}
        filterValues={{
          status: p.status,
          payment: p.payment,
          kind: p.kind,
          party: p.party,
          trip: p.trip,
        }}
        onFilter={(key, value) => p.set({ [key]: value })}
        sort={p.sort}
        direction={p.direction}
        onSort={(key) =>
          p.set({
            sort: key,
            direction: p.sort === key && p.direction === 'desc' ? 'asc' : 'desc',
          })
        }
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPage={(next) => p.set({ page: next })}
        toolbar={
          data && data.total > 0 ? (
            /**
             * The figures for what is filtered, not for the page.
             *
             * "$40,000 outstanding" is the number somebody came here for, and
             * a total covering only the twenty-five rows in front of them is
             * worse than none — it is a number that looks like the answer.
             */
            <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3">
              <div>
                <dt className="text-xs text-muted-foreground">Booked</dt>
                <dd className="text-sm tabular-nums">{money(data.totals.totalCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Received</dt>
                <dd className="text-sm tabular-nums">{money(data.totals.paidCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Outstanding</dt>
                <dd
                  className={
                    data.totals.outstandingCents > 0
                      ? 'text-sm tabular-nums text-status-attention'
                      : 'text-sm tabular-nums'
                  }
                >
                  {money(data.totals.outstandingCents)}
                </dd>
              </div>
            </dl>
          ) : undefined
        }
      />
    </div>
  );
}
