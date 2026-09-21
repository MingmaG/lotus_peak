'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Search, Upload } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { MediaDetailsFields } from './media-picker';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError, apiDelete, apiGet, apiPatch, query } from '@/lib/api-client';
import { fileSize, formatDate } from '@/lib/format';
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
 * not centred in a 16/9 crop of it. Clicking the preview sets where the crop
 * holds, which is the difference between a portrait and the top of somebody's
 * head.
 */
export function MediaLibrary({ canWrite, canDelete }: { canWrite: boolean; canDelete: boolean }) {
  const client = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [needsAlt, setNeedsAlt] = React.useState(false);
  const [open, setOpen] = React.useState<Media | null>(null);
  const [draft, setDraft] = React.useState<Partial<Media>>({});

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

  const save = useMutation({
    mutationFn: () => apiPatch(`/api/media/${open!.id}`, draft),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['media'] });
      setOpen(null);
      setDraft({});
      toast.success('Saved');
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiClientError && error.fields
          ? (Object.values(error.fields)[0] ?? error.message)
          : error.message,
      ),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/media/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['media'] });
      setOpen(null);
      toast.success('Deleted');
    },
    /* A 409 here is the useful case: the message names where it is used. */
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const upload = useMutation({
      /**
       * An array, not the live `FileList`.
       *
       * `mutate()` does not call this function synchronously — it goes through
       * the mutation observer first — and the `onChange` handler that starts
       * an upload clears the input (`event.target.value = ''`) as its next
       * statement. That empties the very `FileList` this closure is holding,
       * so by the time it ran there were no files in it: the loop did nothing,
       * the mutation "succeeded", and the panel said "Uploaded" having sent
       * no request at all. Snapshotting at the call site is what fixes it; the
       * signature is `File[]` so it cannot regress.
       */
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('alt', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
        const response = await fetch('/api/media/upload', { method: 'POST', body: form });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(body?.error?.message ?? `${file.name} could not be uploaded.`);
        }
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['media'] });
      toast.success('Uploaded. Give them a real description before they go on a page.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = data?.items ?? [];
  const current = open ? { ...open, ...draft } : null;

  return (
    <div
      className="space-y-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (canWrite && event.dataTransfer.files.length) {
          upload.mutate(Array.from(event.dataTransfer.files));
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by filename, description or caption…"
            className="pl-8.5"
          />
        </div>

        <Button
          variant={needsAlt ? 'default' : 'outline'}
          onClick={() => setNeedsAlt((value) => !value)}
          className="shrink-0"
        >
          <AlertTriangle className="mr-1.5 size-4" />
          Needs a description
          {backlog?.total ? (
            <span className="ml-1.5 tabular-nums">({backlog.total})</span>
          ) : null}
        </Button>

        {canWrite && (
          <Button variant="outline" asChild disabled={upload.isPending} className="shrink-0">
            <label className="cursor-pointer">
              {upload.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Upload
              <input
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files?.length) upload.mutate(Array.from(event.target.files));
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
              <button
                key={media.id}
                type="button"
                onClick={() => {
                  setOpen(media);
                  setDraft({});
                }}
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
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={open !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle className="truncate">{current.filename}</SheetTitle>
                <SheetDescription>
                  {current.width && current.height
                    ? `${current.width} × ${current.height} · ${fileSize(current.sizeBytes)} · ${current.renditionCount} renditions · added ${formatDate(current.createdAt)}`
                    : fileSize(current.sizeBytes)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 py-4">
                <FocalPicker
                  url={current.url}
                  x={current.focalX}
                  y={current.focalY}
                  disabled={!canWrite}
                  onChange={(focalX, focalY) => setDraft((value) => ({ ...value, focalX, focalY }))}
                />

                <MediaDetailsFields
                  alt={current.alt}
                  isDecorative={current.isDecorative}
                  caption={current.caption ?? ''}
                  credit={current.credit ?? ''}
                  onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))}
                />
              </div>

              <SheetFooter className="flex-row justify-between gap-2 border-t pt-4">
                {canDelete ? (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (window.confirm('Delete this photograph and everything built from it?')) {
                        destroy.mutate(current.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                ) : (
                  <span />
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(null)}>
                    Close
                  </Button>
                  {canWrite && (
                    <Button
                      onClick={() => save.mutate()}
                      disabled={Object.keys(draft).length === 0 || save.isPending}
                    >
                      {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Save
                    </Button>
                  )}
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Where a crop holds.
 *
 * Click the photograph. The three sample frames underneath show what that does
 * at the three shapes the design actually crops to, which is the only way to
 * tell whether a focal point is right without publishing it.
 */
function FocalPicker({
  url,
  x,
  y,
  onChange,
  disabled,
}: {
  url: string;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Where the crop holds</Label>
      <p className="text-xs text-muted-foreground">
        Click the part that must stay in frame. The site crops hard, and this is what keeps a
        face in the picture at 16/9.
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onChange(
            Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
            Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
          );
        }}
        className="relative block w-full overflow-hidden rounded-lg border disabled:cursor-not-allowed"
      >
        <img src={url} alt="" className="w-full" />
        <span
          className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        />
      </button>

      <div className="grid grid-cols-3 gap-2">
        {[
          { ratio: '16/9', label: 'A band' },
          { ratio: '1/1', label: 'A square' },
          { ratio: '3/4', label: 'A masonry cell' },
        ].map((sample) => (
          <div key={sample.ratio} className="space-y-1">
            <div
              className="overflow-hidden rounded border bg-muted"
              style={{ aspectRatio: sample.ratio }}
            >
              <img
                src={url}
                alt=""
                className="size-full object-cover"
                style={{ objectPosition: `${x * 100}% ${y * 100}%` }}
              />
            </div>
            <p className="text-center text-[10px] text-muted-foreground">{sample.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
