'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { MediaMultiPicker } from '@/components/media/media-picker';
import { EmptyState } from '@/components/shared/empty-state';
import { SortableList } from '@/components/shared/sortable-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiDelete, apiPatch, apiPost } from '@/lib/api-client';

interface Row {
  id: string;
  caption: string;
  ratio: string | null;
  media: { id: string; thumbnailUrl: string; alt: string };
}

const RATIOS = ['3/2', '4/3', '16/9', '1/1', '3/4', '2/3'];

/**
 * The gallery.
 *
 * Edited in place rather than through a sheet, because every row is two fields
 * and a photograph, and the thing the office is really doing is arranging
 * twenty-eight pictures into a masonry that reads well — which needs all of
 * them on screen at once.
 *
 * The caption is not the alt text, and the field says so. "Cham, Paro Tshechu"
 * is a caption; the description on the media row says what a cham dancer looks
 * like to somebody who cannot see the photograph. Both exist, and a screen
 * that offered one field would lose whichever one it did not ask for.
 */
export function GalleryScreen({ canWrite, canDelete }: { canWrite: boolean; canDelete: boolean }) {
  const client = useQueryClient();
  const [pending, setPending] = React.useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ items: Row[] }>({
    queryKey: ['gallery'],
    queryFn: () => fetch('/api/gallery').then((response) => response.json()),
  });

  const items = data?.items ?? [];

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      apiPatch(`/api/gallery/${id}`, body),
    onError: (error: Error) => toast.error(error.message),
  });

  const add = useMutation({
    mutationFn: (body: unknown) => apiPost('/api/gallery', body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['gallery'] });
      toast.success('Added');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/gallery/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['gallery'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => apiPatch('/api/gallery', { ids }),
    onError: (error: Error) => {
      toast.error(`Could not save the new order: ${error.message}`);
      void client.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  /**
   * The caption is saved when the field loses focus, not on every keystroke.
   *
   * Twenty-eight rows typed into at once would be a request per character.
   * Blur is the moment somebody has finished with a caption, and it fires on
   * a tab as well as a click.
   */
  const commit = (row: Row) => {
    const next = pending[row.id];
    if (next === undefined || next === row.caption) return;
    patch.mutate({ id: row.id, body: { caption: next } });
    client.setQueryData<{ items: Row[] }>({ queryKey: ['gallery'] } as never, (current) =>
      current
        ? { items: current.items.map((item) => (item.id === row.id ? { ...item, caption: next } : item)) }
        : current,
    );
  };

  const adder = (
    <MediaMultiPicker
      onPick={(media) =>
        add.mutate({
          items: media.map((one) => ({
            mediaId: one.id,
            /* The photograph's own description is a sensible first caption —
               it is at least true — and the field is right there to improve. */
            caption: one.alt || one.filename,
            ratio: null,
            status: 'PUBLISHED',
          })),
        })
      }
      trigger={
        <Button variant="outline" size="sm">
          <ImagePlus className="mr-1.5 size-3.5" />
          Add photographs
        </Button>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="The gallery is empty"
        description="Photographs of Bhutan, each with a caption. The masonry mixes shapes, so a column of identical crops is the one thing to avoid."
        action={canWrite ? adder : undefined}
      />
    );
  }

  return (
    <>
      <SortableList
        items={items}
        itemKey={(row) => row.id}
        onChange={(next) => {
          client.setQueryData(['gallery'], { items: next });
          reorder.mutate(next.map((row) => row.id));
        }}
        onRemove={
          canDelete
            ? (index) => {
                const row = items[index];
                if (row && window.confirm('Take this out of the gallery?')) destroy.mutate(row.id);
              }
            : undefined
        }
        disabled={!canWrite}
        describeItem={(row) => row.caption || 'photograph'}
        renderItem={(row) => (
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.media.thumbnailUrl}
              alt=""
              loading="lazy"
              className="size-14 shrink-0 rounded object-cover"
            />

            <div className="min-w-40 flex-1 space-y-1">
              <Input
                value={pending[row.id] ?? row.caption}
                disabled={!canWrite}
                onChange={(event) =>
                  setPending((current) => ({ ...current, [row.id]: event.target.value }))
                }
                onBlur={() => commit(row)}
                placeholder="Cham, Paro Tshechu"
                className="h-8 text-sm"
                aria-label="Caption"
              />
              <p className="truncate text-[11px] text-muted-foreground">
                Description: {row.media.alt || <span className="text-destructive">none</span>}
              </p>
            </div>

            <Select
              value={row.ratio ?? 'auto'}
              disabled={!canWrite}
              onValueChange={(value) => {
                const ratio = value === 'auto' ? null : value;
                patch.mutate({ id: row.id, body: { ratio } });
                client.setQueryData<{ items: Row[] }>(['gallery'], (current) =>
                  current
                    ? {
                        items: current.items.map((item) =>
                          item.id === row.id ? { ...item, ratio } : item,
                        ),
                      }
                    : current,
                );
              }}
            >
              <SelectTrigger className="h-8 w-32 text-xs" aria-label="Shape in the masonry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Its own shape</SelectItem>
                {RATIOS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />

      {canWrite && <div className="mt-3">{adder}</div>}
    </>
  );
}
