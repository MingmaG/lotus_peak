'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/shared/editor-shell';
import { EditorPage } from '@/components/shared/editor-page';
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
import { formatDate } from '@/lib/format';
import type { DepartureForm } from './departure-form';

/**
 * One departure, on a page of its own.
 *
 * Published departures render as a small table of dates on the journey page.
 */
export function DepartureEditor({
  initial,
  trips,
  canWrite,
  canDelete,
}: {
  initial: DepartureForm;
  trips: { id: string; title: string }[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = React.useState(initial);
  const patch = (next: Partial<DepartureForm>) => setForm((current) => ({ ...current, ...next }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        tripId: form.tripId,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        priceUsd: form.priceUsd,
        placesTotal: form.placesTotal ? Number(form.placesTotal) : null,
        placesLeft: form.placesLeft ? Number(form.placesLeft) : null,
        status: form.status,
        note: form.note || null,
        isFixed: form.isFixed,
        wasPriceUsd: form.wasPriceUsd ? Number(form.wasPriceUsd) : null,
        isPublished: form.isPublished,
      };
      return form.id
        ? apiPatch(`/api/departures/${form.id}`, body)
        : apiPost('/api/departures', body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['departures'] });
      toast.success('Saved');
      router.push('/departures');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const destroy = useMutation({
    mutationFn: () => apiDelete(`/api/departures/${form.id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['departures'] });
      toast.success('Removed');
      router.push('/departures');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const journey = trips.find((trip) => trip.id === form.tripId)?.title;
  const title = form.id
    ? `${journey ?? 'Departure'}, ${formatDate(initial.startDate)}`
    : 'A new departure';

  return (
    <EditorPage
      title={title}
      description="Published departures render as a small table of dates on the journey page."
      crumbs={[{ label: 'Departures', href: '/departures' }, { label: title }]}
      backHref="/departures"
      onSave={() => save.mutate()}
      isSaving={save.isPending}
      canSave={canWrite}
      {...(form.id && canDelete
        ? { onDelete: () => destroy.mutate(), deleteLabel: 'Remove this departure' }
        : {})}
    >
      <div className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="space-y-5">
          {/* The API does not move a departure between journeys — PATCH has no
              tripId — so the choice is offered once, when it is made. A
              departure on the wrong journey is removed and added again. */}
          <Field
            label="Journey"
            hint={form.id ? 'Fixed once the departure exists. Remove it and add another to move it.' : undefined}
          >
            <Select
              value={form.tripId}
              disabled={form.id !== null}
              onValueChange={(tripId) => patch({ tripId })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts">
              <Input
                type="date"
                value={form.startDate}
                onChange={(event) => patch({ startDate: event.target.value })}
              />
            </Field>
            <Field label="Ends">
              <Input
                type="date"
                value={form.endDate}
                onChange={(event) => patch({ endDate: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price, US$" hint="Per person, for this departure.">
              <Input
                type="number"
                value={form.priceUsd}
                onChange={(event) => patch({ priceUsd: Number(event.target.value) })}
              />
            </Field>
            <Field
              label="Was"
              hint="Struck through beside the price, for an early-booking rate. Leave it empty and there is no strike-through."
            >
              <Input
                type="number"
                min={0}
                value={form.wasPriceUsd}
                onChange={(event) => patch({ wasPriceUsd: event.target.value })}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Places" hint="Leave empty not to publish a capacity.">
              <Input
                type="number"
                value={form.placesTotal}
                onChange={(event) => patch({ placesTotal: event.target.value })}
              />
            </Field>
            <Field label="Places left">
              <Input
                type="number"
                value={form.placesLeft}
                onChange={(event) => patch({ placesLeft: event.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Status"
            hint="The site prints this as a word. It never prints “only 2 left” — the design has no urgency in it, and a count that reads as pressure is the same thing wearing a number."
          >
            <Select value={form.status} onValueChange={(status) => patch({ status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="GUARANTEED">Guaranteed to run</SelectItem>
                <SelectItem value="FEW_PLACES">Few places</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Note">
            <Input
              value={form.note}
              placeholder="Timed to Paro Tshechu"
              onChange={(event) => patch({ note: event.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.isFixed} onCheckedChange={(isFixed) => patch({ isFixed })} />
            {/* Most of these journeys are sold as "we will find a date
                together". The fixed ones are the exception, and the site
                lists them as a calendar rather than as an invitation. */}
            A fixed date, running whoever books it
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.isPublished}
              onCheckedChange={(isPublished) => patch({ isPublished })}
            />
            Show it on the site
          </label>
        </div>
      </div>
    </EditorPage>
  );
}
