'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { apiPost } from '@/lib/api-client';
import { money } from '@/lib/format';
import { PAYMENT_METHOD } from './labels';
import { MoneyInput } from './money-input';

/**
 * Recording money against a booking.
 *
 * Opens with the outstanding balance already in the amount box, because that is
 * what is being paid nine times in ten — and because a form that opens on zero
 * is a form where somebody types the figure from the statement and occasionally
 * fat-fingers it.
 *
 * Refunds go through the same sheet with the direction flipped. A separate
 * "refund" form would duplicate every field and be the one that gets a
 * validation rule added six months late.
 */
export function RecordPayment({
  bookingId,
  currency,
  outstandingCents,
  open,
  onOpenChange,
}: {
  bookingId: string;
  currency: string;
  outstandingCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const [form, setForm] = React.useState(() => blank(outstandingCents));
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setForm(blank(outstandingCents));
      setErrors({});
    }
  }, [open, outstandingCents]);

  const create = useMutation({
    mutationFn: () =>
      apiPost('/api/payments', {
        bookingId,
        direction: form.direction,
        kind: form.kind,
        status: form.status,
        method: form.method,
        amountCents: form.amountCents,
        currency,
        feeCents: form.feeCents,
        providerRef: form.providerRef.trim() || null,
        paidAt: new Date(form.paidAt).toISOString(),
        notes: form.notes.trim() || null,
      }),
    onSuccess: () => {
      /* The booking's paid total moved, and so did every list that shows it. */
      void client.invalidateQueries({ queryKey: ['booking', bookingId] });
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Recorded');
      onOpenChange(false);
    },
    onError: (error: Error & { fields?: Record<string, string> }) => {
      if (error.fields) setErrors(error.fields);
      else toast.error(error.message, { duration: 8_000 });
    },
  });

  const out = form.direction === 'OUT';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{out ? 'Refund' : 'Record a payment'}</SheetTitle>
          <SheetDescription>
            {outstandingCents > 0
              ? `${money(outstandingCents, currency)} is outstanding on this booking.`
              : 'This booking has been paid in full.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          <Field label="Which way">
            <Select
              value={form.direction}
              onValueChange={(direction) =>
                setForm({
                  ...form,
                  direction,
                  /* The kind has to agree with the direction — the API refuses
                     a refund that goes in — so it moves with it rather than
                     leaving somebody to discover the rule from a 422. */
                  kind: direction === 'OUT' ? 'REFUND' : 'DEPOSIT',
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">Money received</SelectItem>
                <SelectItem value="OUT">Money refunded</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Amount" error={errors.amountCents}>
            <MoneyInput
              cents={form.amountCents}
              onCents={(amountCents) => setForm({ ...form, amountCents })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What for" error={errors.kind}>
              <Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {out ? (
                    <>
                      <SelectItem value="REFUND">Refund</SelectItem>
                      <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="DEPOSIT">Deposit</SelectItem>
                      <SelectItem value="BALANCE">Balance</SelectItem>
                      <SelectItem value="FULL">Paid in full</SelectItem>
                      <SelectItem value="EXTRA">Something extra</SelectItem>
                      <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </Field>

            <Field label="How" error={errors.method}>
              <Select
                value={form.method}
                onValueChange={(method) => setForm({ ...form, method })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="On" error={errors.paidAt}>
              <Input
                type="date"
                value={form.paidAt}
                onChange={(event) => setForm({ ...form, paidAt: event.target.value })}
              />
            </Field>

            <Field
              label="Has it cleared?"
              hint="A transfer from Europe takes days."
            >
              <Select
                value={form.status}
                onValueChange={(status) => setForm({ ...form, status })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPLETED">Yes, it has cleared</SelectItem>
                  <SelectItem value="PENDING">Expected, not yet arrived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Bank fee"
            hint="What the bank took. The booking still counts as paid in full — this is so the difference is visible rather than chased."
          >
            <MoneyInput
              cents={form.feeCents}
              onCents={(feeCents) => setForm({ ...form, feeCents })}
            />
          </Field>

          <Field
            label="Their reference"
            hint="Off the statement, for reconciling."
            error={errors.providerRef}
          >
            <Input
              value={form.providerRef}
              className="font-mono"
              onChange={(event) => setForm({ ...form, providerRef: event.target.value })}
            />
          </Field>

          <Field label="Note">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || form.amountCents <= 0}
          >
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {out ? 'Record the refund' : 'Record it'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function blank(outstandingCents: number) {
  return {
    direction: 'IN',
    kind: 'DEPOSIT',
    status: 'COMPLETED',
    method: 'BANK_TRANSFER',
    amountCents: Math.max(0, outstandingCents),
    feeCents: 0,
    providerRef: '',
    paidAt: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}
