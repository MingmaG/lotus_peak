'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, Section } from '@/components/shared/editor-shell';
import { EditorPage } from '@/components/shared/editor-page';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import { MoneyInput } from './money-input';
import type { CouponForm } from './coupon-form';

/**
 * One coupon, on a page of its own.
 *
 * It used to be a sheet over the list. A coupon is a dozen fields and a list
 * of every journey to tick, which did not fit in one, and a page gives it an
 * address somebody can send to a colleague — "is SPRING26 right?".
 */
export function CouponEditor({
  initial,
  trips,
  canWrite,
  canDelete,
}: {
  initial: CouponForm;
  trips: { id: string; title: string }[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = React.useState<CouponForm>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        value: form.kind === 'PERCENTAGE' ? form.percentage : form.amountCents,
        currency: 'USD',
        minSpendCents: form.minSpendCents || null,
        /* A cap only means something on a percentage — the API refuses one on
           a fixed amount, so it is not sent rather than sent and rejected. */
        maxDiscountCents: form.kind === 'PERCENTAGE' ? form.maxDiscountCents || null : null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        maxPerCustomer: form.maxPerCustomer ? Number(form.maxPerCustomer) : null,
        tripIds: form.tripIds,
        isActive: form.isActive,
      };
      return form.id ? apiPatch(`/api/coupons/${form.id}`, body) : apiPost('/api/coupons', body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['coupons'] });
      setErrors({});
      toast.success('Saved');
      router.push('/coupons');
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
      toast.success('Removed');
      router.push('/coupons');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const title = form.id ? initial.code : 'A new coupon';

  return (
    <EditorPage
      title={title}
      description="Codes are stored in capitals and matched in any case, so a traveller who types it in lower case is not turned away."
      crumbs={[{ label: 'Coupons', href: '/coupons' }, { label: title }]}
      backHref="/coupons"
      onSave={() => save.mutate()}
      isSaving={save.isPending}
      canSave={canWrite}
      onDelete={form.id && canDelete ? () => destroy.mutate(form.id!) : undefined}
      deleteDescription="A coupon somebody has already used cannot be removed — switch it off instead."
    >
      <Section title="What it takes off">
        <Field label="Code" error={errors.code}>
          <Input
            value={form.code}
            className="font-mono uppercase"
            placeholder="SPRING26"
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          />
        </Field>

        <Field label="What it is for" error={errors.description}>
          <Input
            value={form.description}
            placeholder="Early booking, spring departures"
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind">
            <Select value={form.kind} onValueChange={(kind) => setForm({ ...form, kind })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">A percentage</SelectItem>
                <SelectItem value="FIXED_AMOUNT">An amount</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.kind === 'PERCENTAGE' ? (
            <Field label="Per cent off" error={errors.value}>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.percentage}
                onChange={(event) =>
                  setForm({
                    ...form,
                    percentage: Number(event.target.value) || 0,
                  })
                }
              />
            </Field>
          ) : (
            <Field label="Amount off" error={errors.value}>
              <MoneyInput
                cents={form.amountCents}
                onCents={(amountCents) => setForm({ ...form, amountCents })}
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
              cents={form.minSpendCents}
              onCents={(minSpendCents) => setForm({ ...form, minSpendCents })}
            />
          </Field>

          {form.kind === 'PERCENTAGE' && (
            <Field
              label="But no more than"
              hint="“20% off, up to $500”. Zero for no cap."
              error={errors.maxDiscountCents}
            >
              <MoneyInput
                cents={form.maxDiscountCents}
                onCents={(maxDiscountCents) => setForm({ ...form, maxDiscountCents })}
              />
            </Field>
          )}
        </div>
      </Section>

      <Section title="When, and for whom">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" error={errors.startsAt}>
            <Input
              type="date"
              value={form.startsAt}
              onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            />
          </Field>
          <Field label="Ends" error={errors.endsAt}>
            <Input
              type="date"
              value={form.endsAt}
              onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="In total, at most" hint="Uses across everybody. Empty for no limit.">
            <Input
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })}
            />
          </Field>
          <Field label="Per customer, at most">
            <Input
              type="number"
              min={1}
              value={form.maxPerCustomer}
              onChange={(event) => setForm({ ...form, maxPerCustomer: event.target.value })}
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
                    checked={form.tripIds.includes(trip.id)}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        tripIds: checked
                          ? [...form.tripIds, trip.id]
                          : form.tripIds.filter((id) => id !== trip.id),
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
            checked={form.isActive}
            onCheckedChange={(isActive) => setForm({ ...form, isActive })}
          />
          Usable now
        </label>
      </Section>
    </EditorPage>
  );
}
