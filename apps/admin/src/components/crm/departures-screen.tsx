'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api-client';
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
  isFixed: boolean;
  wasPriceUsd: number | null;
  isPublished: boolean;
  trip: { id: string; title: string; slug: string };
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
export function DeparturesScreen({ canWrite }: { canWrite: boolean }) {
  const [past, setPast] = React.useState(false);

  const { data, isLoading } = useQuery<{ items: Row[] }>({
    queryKey: ['departures', past],
    queryFn: () => apiGet(`/api/departures${past ? '?past=1' : ''}`),
  });

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
          <Button size="sm" asChild>
            <Link href="/departures/new">
              <Plus className="mr-1.5 size-3.5" />
              Add a departure
            </Link>
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
              <Link
                href={`/departures/${row.id}`}
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
              </Link>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
