'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, Loader2, Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { currency, formatDate, humanise } from '@/lib/format';

interface Row {
  id: string;
  startDate: string;
  endDate: string;
  priceUsd: number;
  placesTotal: number | null;
  placesLeft: number | null;
  status: string;
  note: string | null;
  isPublished: boolean;
  trip: { id: string; title: string; slug: string };
}

interface Form {
  id: string | null;
  tripId: string;
  startDate: string;
  endDate: string;
  priceUsd: number;
  placesTotal: string;
  placesLeft: string;
  status: string;
  note: string;
  isPublished: boolean;
}

/**
 * Dated departures.
 *
 * Not in the original design, which sells journeys rather than dates — but the
 * office runs them on dates and every enquiry starts by asking when. A journey
 * with no published departures renders nothing on the site, so the design is
 * unchanged until the office chooses otherwise.
 *
 * `placesLeft` exists and the site shows it as a status word, never as "only 2
 * left". The design forbids urgency, and a count that reads as pressure is the
 * same thing wearing a number.
 */
export function DeparturesScreen({
  trips,
  canWrite,
}: {
  trips: { id: string; title: string }[];
  canWrite: boolean;
}) {
  const client = useQueryClient();
  const [past, setPast] = React.useState(false);
  const [editing, setEditing] = React.useState<Form | null>(null);

  const { data, isLoading } = useQuery<{ items: Row[] }>({
    queryKey: ['departures', past],
    queryFn: () => apiGet(`/api/departures${past ? '?past=1' : ''}`),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Nothing to save.');
      const body = {
        tripId: editing.tripId,
        startDate: new Date(editing.startDate).toISOString(),
        endDate: new Date(editing.endDate).toISOString(),
        priceUsd: editing.priceUsd,
        placesTotal: editing.placesTotal ? Number(editing.placesTotal) : null,
        placesLeft: editing.placesLeft ? Number(editing.placesLeft) : null,
        status: editing.status,
        note: editing.note || null,
        isPublished: editing.isPublished,
      };
      return editing.id
        ? apiPatch(`/api/departures/${editing.id}`, body)
        : apiPost('/api/departures', body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['departures'] });
      setEditing(null);
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/departures/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['departures'] });
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const blank = (): Form => {
    const start = new Date();
    start.setMonth(start.getMonth() + 3);
    const end = new Date(start);
    end.setDate(end.getDate() + 10);
    return {
      id: null,
      tripId: trips[0]?.id ?? '',
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      priceUsd: 0,
      placesTotal: '',
      placesLeft: '',
      status: 'OPEN',
      note: '',
      isPublished: true,
    };
  };

  return (
    <div className="space-y-4">
      {/* Wraps on a narrow screen: the tab pair and the button are together
          wider than a 320px viewport. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={past ? 'past' : 'ahead'} onValueChange={(value) => setPast(value === 'past')}>
          <TabsList>
            <TabsTrigger value="ahead">Ahead</TabsTrigger>
            <TabsTrigger value="past">Been and gone</TabsTrigger>
          </TabsList>
        </Tabs>

        {canWrite && (
          <Button size="sm" onClick={() => setEditing(blank())}>
            <Plus className="mr-1.5 size-3.5" />
            Add a departure
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={past ? 'Nothing in the past' : 'Nothing scheduled'}
          description="A journey with no published departures shows no dates on the site, which is how it read before this screen existed."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {data?.items.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                disabled={!canWrite}
                onClick={() =>
                  setEditing({
                    id: row.id,
                    tripId: row.trip.id,
                    startDate: row.startDate.slice(0, 10),
                    endDate: row.endDate.slice(0, 10),
                    priceUsd: row.priceUsd,
                    placesTotal: row.placesTotal?.toString() ?? '',
                    placesLeft: row.placesLeft?.toString() ?? '',
                    status: row.status,
                    note: row.note ?? '',
                    isPublished: row.isPublished,
                  })
                }
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left transition-colors hover:bg-muted/40"
              >
                {/* `basis-full` on a phone: the title and the dates take the
                    row, and the price, status and visibility wrap under them.
                    Without it the four sit on one line and a 320px screen
                    scrolls sideways. */}
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                  <p className="text-sm font-medium">{row.trip.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.startDate)} – {formatDate(row.endDate)}
                    {row.placesTotal !== null &&
                      ` · ${row.placesLeft ?? row.placesTotal} of ${row.placesTotal} places`}
                    {row.note && ` · ${row.note}`}
                  </p>
                </div>

                <span className="shrink-0 text-sm tabular-nums">{currency(row.priceUsd)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {humanise(row.status)}
                </span>
                {!row.isPublished && (
                  <span className="shrink-0 text-xs italic text-muted-foreground">hidden</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>{editing.id ? 'This departure' : 'A new departure'}</SheetTitle>
                <SheetDescription>
                  Published departures render as a small table of dates on the journey page.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 py-4">
                <Field label="Journey">
                  <Select
                    value={editing.tripId}
                    onValueChange={(tripId) => setEditing({ ...editing, tripId })}
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
                      value={editing.startDate}
                      onChange={(event) => setEditing({ ...editing, startDate: event.target.value })}
                    />
                  </Field>
                  <Field label="Ends">
                    <Input
                      type="date"
                      value={editing.endDate}
                      onChange={(event) => setEditing({ ...editing, endDate: event.target.value })}
                    />
                  </Field>
                </div>

                <Field label="Price, US$" hint="Per person, for this departure.">
                  <Input
                    type="number"
                    value={editing.priceUsd}
                    onChange={(event) =>
                      setEditing({ ...editing, priceUsd: Number(event.target.value) })
                    }
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Places" hint="Leave empty not to publish a capacity.">
                    <Input
                      type="number"
                      value={editing.placesTotal}
                      onChange={(event) =>
                        setEditing({ ...editing, placesTotal: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Places left">
                    <Input
                      type="number"
                      value={editing.placesLeft}
                      onChange={(event) =>
                        setEditing({ ...editing, placesLeft: event.target.value })
                      }
                    />
                  </Field>
                </div>

                <Field
                  label="Status"
                  hint="The site prints this as a word. It never prints “only 2 left” — the design has no urgency in it, and a count that reads as pressure is the same thing wearing a number."
                >
                  <Select
                    value={editing.status}
                    onValueChange={(status) => setEditing({ ...editing, status })}
                  >
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
                    value={editing.note}
                    placeholder="Timed to Paro Tshechu"
                    onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                  />
                </Field>

                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={editing.isPublished}
                    onCheckedChange={(isPublished) => setEditing({ ...editing, isPublished })}
                  />
                  Show it on the site
                </label>
              </div>

              <SheetFooter className="flex-row justify-between gap-2 border-t pt-4">
                {editing.id ? (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm('Remove this departure?')) destroy.mutate(editing.id!);
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
    </div>
  );
}
