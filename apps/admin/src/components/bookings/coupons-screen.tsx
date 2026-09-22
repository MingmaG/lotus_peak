'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Percent, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { DataTable, type Column } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Field } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { apiDelete, apiGet, apiPatch, apiPost, query } from '@/lib/api-client';
import { formatDate, money } from '@/lib/format';
import { MoneyInput } from './money-input';

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

interface Form {
  id: string | null;
  code: string;
  description: string;
  kind: string;
  percentage: number;
  amountCents: number;
  minSpendCents: number;
  maxDiscountCents: number;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  maxPerCustomer: string;
  tripIds: string[];
  isActive: boolean;
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
    row.kind === 'PERCENTAGE'
      ? `${row.value}% off`
      : `${money(row.value, row.currency)} off`;
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

export function CouponsScreen({
  trips,
  canWrite,
  canDelete,
}: {
  trips: { id: string; title: string }[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [editing, setEditing] = React.useState<Form | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

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

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Nothing to save.');
      const body = {
        code: editing.code.trim(),
        description: editing.description.trim() || null,
        kind: editing.kind,
        value: editing.kind === 'PERCENTAGE' ? editing.percentage : editing.amountCents,
        currency: 'USD',
        minSpendCents: editing.minSpendCents || null,
        /* A cap only means something on a percentage — the API refuses one on
           a fixed amount, so it is not sent rather than sent and rejected. */
        maxDiscountCents:
          editing.kind === 'PERCENTAGE' ? editing.maxDiscountCents || null : null,
        startsAt: editing.startsAt ? new Date(editing.startsAt).toISOString() : null,
        endsAt: editing.endsAt ? new Date(editing.endsAt).toISOString() : null,
        maxRedemptions: editing.maxRedemptions ? Number(editing.maxRedemptions) : null,
        maxPerCustomer: editing.maxPerCustomer ? Number(editing.maxPerCustomer) : null,
        tripIds: editing.tripIds,
        isActive: editing.isActive,
      };
      return editing.id
        ? apiPatch(`/api/coupons/${editing.id}`, body)
        : apiPost('/api/coupons', body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coupons'] });
      setEditing(null);
      setErrors({});
      toast.success('Saved');
    },
    onError: (error: Error & { fields?: Record<string, string> }) => {
      if (error.fields) setErrors(error.fields);
      else toast.error(error.message, { duration: 8_000 });
    },
  });

  const destroy = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/coupons/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coupons'] });
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const blank = (): Form => ({
    id: null,
    code: '',
    description: '',
    kind: 'PERCENTAGE',
    percentage: 10,
    amountCents: 0,
    minSpendCents: 0,
    maxDiscountCents: 0,
    startsAt: '',
    endsAt: '',
    maxRedemptions: '',
    maxPerCustomer: '',
    tripIds: [],
    isActive: true,
  });

  const open = (row: CouponRow) =>
    setEditing({
      id: row.id,
      code: row.code,
      description: row.description ?? '',
      kind: row.kind,
      percentage: row.kind === 'PERCENTAGE' ? row.value : 10,
      amountCents: row.kind === 'FIXED_AMOUNT' ? row.value : 0,
      minSpendCents: row.minSpendCents ?? 0,
      maxDiscountCents: row.maxDiscountCents ?? 0,
      startsAt: row.startsAt?.slice(0, 10) ?? '',
      endsAt: row.endsAt?.slice(0, 10) ?? '',
      maxRedemptions: row.maxRedemptions?.toString() ?? '',
      maxPerCustomer: row.maxPerCustomer?.toString() ?? '',
      tripIds: row.trips.map((one) => one.tripId),
      isActive: row.isActive,
    });

  const columns: Column<CouponRow>[] = [
    {
      key: 'code',
      label: 'Code',
      primary: true,
      render: (row) => (
        <button
          type="button"
          disabled={!canWrite}
          onClick={() => open(row)}
          className="flex flex-col gap-0.5 text-left disabled:cursor-default"
        >
          <span className="font-mono text-sm">{row.code}</span>
          {row.description && (
            <span className="text-xs font-normal text-muted-foreground">{row.description}</span>
          )}
        </button>
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
    <>
      <DataTable
        rows={data?.items ?? []}
        columns={columns}
        rowKey={(row) => row.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Percent}
            title="No coupons"
            description="A code, what it takes off, and the rules about who may use it. Applied on the booking form; nothing on the website reads these."
            action={
              canWrite ? (
                <Button size="sm" onClick={() => setEditing(blank())}>
                  <Plus className="mr-1.5 size-3.5" />
                  Make a coupon
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
              <Button size="sm" onClick={() => setEditing(blank())}>
                <Plus className="mr-1.5 size-3.5" />
                Make a coupon
              </Button>
            </div>
          ) : undefined
        }
      />

      <Sheet
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null);
            setErrors({});
          }
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>{editing.id ? editing.code : 'A new coupon'}</SheetTitle>
                <SheetDescription>
                  Codes are stored in capitals and matched in any case, so a traveller who
                  types it in lower case is not turned away.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 py-4">
                <Field label="Code" error={errors.code}>
                  <Input
                    value={editing.code}
                    className="font-mono uppercase"
                    placeholder="SPRING26"
                    onChange={(event) =>
                      setEditing({ ...editing, code: event.target.value.toUpperCase() })
                    }
                  />
                </Field>

                <Field label="What it is for" error={errors.description}>
                  <Input
                    value={editing.description}
                    placeholder="Early booking, spring departures"
                    onChange={(event) =>
                      setEditing({ ...editing, description: event.target.value })
                    }
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kind">
                    <Select
                      value={editing.kind}
                      onValueChange={(kind) => setEditing({ ...editing, kind })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">A percentage</SelectItem>
                        <SelectItem value="FIXED_AMOUNT">An amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {editing.kind === 'PERCENTAGE' ? (
                    <Field label="Per cent off" error={errors.value}>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={editing.percentage}
                        onChange={(event) =>
                          setEditing({ ...editing, percentage: Number(event.target.value) || 0 })
                        }
                      />
                    </Field>
                  ) : (
                    <Field label="Amount off" error={errors.value}>
                      <MoneyInput
                        cents={editing.amountCents}
                        onCents={(amountCents) => setEditing({ ...editing, amountCents })}
                      />
                    </Field>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Only over"
                    hint="Leave at zero for no minimum."
                    error={errors.minSpendCents}
                  >
                    <MoneyInput
                      cents={editing.minSpendCents}
                      onCents={(minSpendCents) => setEditing({ ...editing, minSpendCents })}
                    />
                  </Field>

                  {editing.kind === 'PERCENTAGE' && (
                    <Field
                      label="But no more than"
                      hint="“20% off, up to $500”. Zero for no cap."
                      error={errors.maxDiscountCents}
                    >
                      <MoneyInput
                        cents={editing.maxDiscountCents}
                        onCents={(maxDiscountCents) =>
                          setEditing({ ...editing, maxDiscountCents })
                        }
                      />
                    </Field>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Starts" error={errors.startsAt}>
                    <Input
                      type="date"
                      value={editing.startsAt}
                      onChange={(event) =>
                        setEditing({ ...editing, startsAt: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Ends" error={errors.endsAt}>
                    <Input
                      type="date"
                      value={editing.endsAt}
                      onChange={(event) => setEditing({ ...editing, endsAt: event.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="In total, at most" hint="Uses across everybody. Empty for no limit.">
                    <Input
                      type="number"
                      min={1}
                      value={editing.maxRedemptions}
                      onChange={(event) =>
                        setEditing({ ...editing, maxRedemptions: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Per customer, at most">
                    <Input
                      type="number"
                      min={1}
                      value={editing.maxPerCustomer}
                      onChange={(event) =>
                        setEditing({ ...editing, maxPerCustomer: event.target.value })
                      }
                    />
                  </Field>
                </div>

                <Field
                  label="Which journeys"
                  hint="None ticked means every journey, which is the usual case."
                >
                  <ul className="space-y-2 rounded-md border p-3">
                    {trips.map((trip) => (
                      <li key={trip.id}>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editing.tripIds.includes(trip.id)}
                            onCheckedChange={(checked) =>
                              setEditing({
                                ...editing,
                                tripIds: checked
                                  ? [...editing.tripIds, trip.id]
                                  : editing.tripIds.filter((id) => id !== trip.id),
                              })
                            }
                          />
                          {trip.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                </Field>

                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.isActive}
                    onCheckedChange={(isActive) => setEditing({ ...editing, isActive })}
                  />
                  Usable now
                </label>
              </div>

              <SheetFooter className="flex-row justify-between gap-2 border-t pt-4">
                {editing.id && canDelete ? (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Remove ${editing.code}?`)) destroy.mutate(editing.id!);
                    }}
                  >
                    Remove
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
