'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { UploadDialog } from './upload-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, query } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Media {
  id: string;
  url: string;
  thumbnailUrl: string;
  alt: string;
  isDecorative: boolean;
  caption: string | null;
  credit: string | null;
  filename: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  focalX: number;
  focalY: number;
  createdAt: string;
  renditionCount: number;
}

/**
 * The library.
 *
 * Two things it does that a grid of thumbnails does not:
 *
 * **It makes the backlog visible.** "Needs a description" is a filter and a
 * count, because an image with no alt text is invisible to anybody using a
 * screen reader and there is no other way to find the fourteen that were
 * dropped in during a busy week.
 *
 * **It has a focal point control.** The design crops hard — parallax bands,
 * masked strips, 3/4 masonry cells — and a face centred in a 3/2 photograph is
 * not centred in a 16/9 crop of it. A photograph's own page sets where the
 * crop holds, which is the difference between a portrait and the top of
 * somebody's head.
 *
 * The filters live in the address, so a photograph opened from the backlog
 * returns to the backlog — see `MediaEditor`.
 */
export function MediaLibrary({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get('q') ?? '';
  const needsAlt = params.get('needsAlt') === '1';

  const setFilters = React.useCallback(
    (next: { q?: string; needsAlt?: boolean }) => {
      const out = new URLSearchParams(params.toString());
      if (next.q !== undefined) {
        if (next.q) out.set('q', next.q);
        else out.delete('q');
      }
      if (next.needsAlt !== undefined) {
        if (next.needsAlt) out.set('needsAlt', '1');
        else out.delete('needsAlt');
      }
      const qs = out.toString();
      router.replace(qs ? `/media?${qs}` : '/media', { scroll: false });
    },
    [params, router],
  );
  const listQuery = params.toString();

  /* Typed into locally and written to the address a beat later: an input
     bound straight to the URL drops keystrokes while each navigation lands. */
  const [text, setText] = React.useState(search);
  React.useEffect(() => {
    if (text === search) return;
    const timer = window.setTimeout(() => setFilters({ q: text }), 250);
    return () => window.clearTimeout(timer);
  }, [text, search, setFilters]);

  const { data, isLoading } = useQuery<{ items: Media[]; total: number }>({
    queryKey: ['media', 'library', search, needsAlt],
    queryFn: () =>
      apiGet(`/api/media${query({ q: search, needsAlt: needsAlt ? 1 : undefined, perPage: 100 })}`),
  });

  /* The count for the filter's label, from an unfiltered read. */
  const { data: backlog } = useQuery<{ total: number }>({
    queryKey: ['media', 'backlog'],
    queryFn: () => apiGet('/api/media?needsAlt=1&perPage=1'),
  });

  /**
   * Files chosen but not yet sent.
   *
   * `UploadDialog` asks for a description first. Before it existed the
   * filename was sent as the description — "IMG 4471" — which is not one, and
   * which is not blank either, so the "Needs a description" filter beside this
   * could not see a single one of them.
   */
  const [pending, setPending] = React.useState<File[]>([]);

  const items = data?.items ?? [];

  return (
    <div
      className="space-y-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (canWrite && event.dataTransfer.files.length) {
          setPending(Array.from(event.dataTransfer.files));
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search by filename, description or caption…"
            className="pl-8.5"
          />
        </div>

        <Button
          variant={needsAlt ? 'default' : 'outline'}
          onClick={() => setFilters({ needsAlt: !needsAlt })}
          className="shrink-0"
        >
          <AlertTriangle className="mr-1.5 size-4" />
          Needs a description
          {backlog?.total ? (
            <span className="ml-1.5 tabular-nums">({backlog.total})</span>
          ) : null}
        </Button>

        {canWrite && (
          <Button variant="outline" asChild className="shrink-0">
            <label className="cursor-pointer">
              <Upload className="mr-2 size-4" />
              Upload
              <input
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files?.length) setPending(Array.from(event.target.files));
                  /* Clears the input so the same file can be chosen twice running.
                     It also empties `event.target.files`, which is why the line
                     above copies it first. */
                  event.target.value = '';
                }}
              />
            </label>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="aspect-4/3 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={
            needsAlt
              ? 'Everything is described'
              : search
                ? 'Nothing matches that'
                : 'The library is empty'
          }
          description={
            needsAlt
              ? 'Every photograph either has a description or is marked decorative.'
              : 'Drop files anywhere on this page, or use the Upload button.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((media) => {
            const undescribed = !media.alt && !media.isDecorative;
            return (
              <Link
                key={media.id}
                href={listQuery ? `/media/${media.id}?${listQuery}` : `/media/${media.id}`}
                className={cn(
                  'overflow-hidden rounded-lg border text-left transition-colors hover:border-primary/50',
                  undescribed && 'border-destructive/40',
                )}
              >
                <img
                  src={media.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover"
                  style={{ objectPosition: `${media.focalX * 100}% ${media.focalY * 100}%` }}
                />
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{media.filename}</p>
                  <p
                    className={cn(
                      'line-clamp-2 text-[11px]',
                      undescribed ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {media.isDecorative
                      ? 'Decorative'
                      : media.alt || 'Needs a description'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <UploadDialog
        files={pending}
        onClose={() => setPending([])}
        onUploaded={() => {
          void client.invalidateQueries({ queryKey: ['media'] });
          /* Both filters are cleared, because the commonest way a fresh upload
             goes missing is that the list is still showing a search, or the
             "Needs a description" backlog it is no longer part of. */
          setText('');
          setFilters({ q: '', needsAlt: false });
        }}
      />
    </div>
  );
}
