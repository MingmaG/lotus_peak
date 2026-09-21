'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Loader2, Search, Upload, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { apiGet, query } from '@/lib/api-client';
import { fileSize } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Choosing a photograph.
 *
 * Used by every content screen, which is why it does the awkward parts once:
 * it uploads as well as browses, it refuses to accept an image without a
 * description, and it shows the description on the tile so the office can see
 * which pictures still need one.
 */

export interface PickedMedia {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  filename: string;
  isDecorative: boolean;
  focalX: number;
  focalY: number;
  sizeBytes: number;
}

interface MediaPage {
  items: PickedMedia[];
  total: number;
  page: number;
  totalPages: number;
}

export function MediaPicker({
  value,
  onChange,
  label = 'Photograph',
  description,
  /** Clears the selection. Off where the field is required. */
  clearable = true,
}: {
  value: PickedMedia | null;
  onChange: (media: PickedMedia | null) => void;
  label?: string;
  description?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {value && clearable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        )}
      </div>

      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group relative flex w-full items-center gap-3 overflow-hidden rounded-lg border p-2 text-left transition-colors hover:border-primary/50',
          !value && 'border-dashed py-6 justify-center',
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.url}
              alt=""
              className="size-16 shrink-0 rounded object-cover"
              style={{ objectPosition: `${value.focalX * 100}% ${value.focalY * 100}%` }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{value.filename}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {value.isDecorative ? (
                  <span className="italic">Marked decorative — no description</span>
                ) : value.alt ? (
                  value.alt
                ) : (
                  /* The one state this component exists to make visible. */
                  <span className="text-destructive">
                    No description. Somebody using a screen reader will hear nothing here.
                  </span>
                )}
              </p>
              {value.width && value.height && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {value.width} × {value.height} · {fileSize(value.sizeBytes)}
                </p>
              )}
            </div>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="size-4" />
            Choose a photograph
          </span>
        )}
      </button>

      <MediaDialog
        open={open}
        onOpenChange={setOpen}
        onPick={(media) => {
          onChange(media);
          setOpen(false);
        }}
      />
    </div>
  );
}

/** Choosing several at once — a gallery, a strip, an itinerary day. */
export function MediaMultiPicker({
  onPick,
  trigger,
}: {
  onPick: (media: PickedMedia[]) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <MediaDialog
        open={open}
        onOpenChange={setOpen}
        multiple
        onPickMany={(media) => {
          onPick(media);
          setOpen(false);
        }}
      />
    </>
  );
}

function MediaDialog({
  open,
  onOpenChange,
  onPick,
  onPickMany,
  multiple,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick?: (media: PickedMedia) => void;
  onPickMany?: (media: PickedMedia[]) => void;
  multiple?: boolean;
}) {
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<PickedMedia[]>([]);
  const client = useQueryClient();

  const { data, isLoading } = useQuery<MediaPage>({
    queryKey: ['media', search],
    queryFn: () => apiGet<MediaPage>(`/api/media${query({ q: search, perPage: 60 })}`),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) setSelected([]);
  }, [open]);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const out: PickedMedia[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        /**
         * Uploaded with the filename as a placeholder description.
         *
         * Not blank. A blank one is refused by the service — which is right —
         * and refusing a drag-and-drop of twenty photographs because none of
         * them has been described yet is a dialog nobody can use. The filename
         * is visibly a placeholder, the tile flags it, and the library's Needs
         * a description filter lists every one.
         */
        form.append('alt', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
        const response = await fetch('/api/media/upload', { method: 'POST', body: form });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(body?.error?.message ?? `${file.name} could not be uploaded.`);
        }
        out.push(((await response.json()) as { media: PickedMedia }).media);
      }
      return out;
    },
    onSuccess: (media) => {
      void client.invalidateQueries({ queryKey: ['media'] });
      toast.success(`${media.length} ${media.length === 1 ? 'photograph' : 'photographs'} uploaded`);
      if (!multiple && media[0]) onPick?.(media[0]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>
            Every photograph on the site. Drag files in, or use the button.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by filename or description…"
              className="pl-8.5"
            />
          </div>
          <Button type="button" variant="outline" asChild disabled={upload.isPending}>
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
                  if (event.target.files?.length) upload.mutate(event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
          </Button>
        </div>

        <div
          className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files.length) upload.mutate(event.dataTransfer.files);
          }}
        >
          {isLoading && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          )}

          {!isLoading && items.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {search ? 'Nothing matches that.' : 'The library is empty. Drop some files here.'}
            </p>
          )}

          {items.map((media) => {
            const isSelected = selected.some((item) => item.id === media.id);
            const undescribed = !media.alt && !media.isDecorative;
            return (
              <button
                key={media.id}
                type="button"
                onClick={() => {
                  if (!multiple) return onPick?.(media);
                  setSelected((current) =>
                    isSelected
                      ? current.filter((item) => item.id !== media.id)
                      : [...current, media],
                  );
                }}
                className={cn(
                  'group relative overflow-hidden rounded-lg border text-left transition-all',
                  isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.url}
                  alt=""
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover"
                  style={{
                    objectPosition: `${media.focalX * 100}% ${media.focalY * 100}%`,
                  }}
                />
                <div className="p-1.5">
                  <p className="truncate text-[11px] font-medium">{media.filename}</p>
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
                {multiple && isSelected && (
                  <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                    {selected.findIndex((item) => item.id === media.id) + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {multiple && (
          <DialogFooter className="sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selected.length} selected
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={selected.length === 0}
                onClick={() => onPickMany?.(selected)}
              >
                Add {selected.length > 0 && selected.length}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Editing what is known about one photograph.
 *
 * Reachable from the library and from the picker, because the commonest moment
 * somebody notices a missing description is while choosing the photograph for
 * a page — and making them leave the page they are editing to fix it is how a
 * library ends up with forty undescribed images.
 */
export function MediaDetailsFields({
  alt,
  isDecorative,
  caption,
  credit,
  onChange,
}: {
  alt: string;
  isDecorative: boolean;
  caption: string;
  credit: string;
  onChange: (patch: Partial<{ alt: string; isDecorative: boolean; caption: string; credit: string }>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="media-alt">Description</Label>
        <Textarea
          id="media-alt"
          value={alt}
          disabled={isDecorative}
          onChange={(event) => onChange({ alt: event.target.value })}
          rows={3}
          placeholder="What is in the photograph, for somebody who cannot see it."
        />
        <p className="text-xs text-muted-foreground">
          Describe what is there, not what it is called. &ldquo;Rinpung Dzong above the Paro
          valley with fresh snow on the peaks&rdquo; — not &ldquo;paro-dzong.jpg&rdquo;.
        </p>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="media-decorative"
          checked={isDecorative}
          onCheckedChange={(checked) => onChange({ isDecorative: checked === true })}
        />
        <div className="space-y-1">
          <Label htmlFor="media-decorative" className="font-normal">
            This is decorative
          </Label>
          <p className="text-xs text-muted-foreground">
            A texture, an ornament, a pattern — something that carries no information. It
            will be hidden from screen readers rather than described.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="media-caption">Caption</Label>
        <Input
          id="media-caption"
          value={caption}
          onChange={(event) => onChange({ caption: event.target.value })}
          placeholder="Printed under the photograph, where a page prints one."
        />
        <p className="text-xs text-muted-foreground">
          Different from the description. &ldquo;Cham, Paro Tshechu&rdquo; is a caption;
          the description says what a cham dancer looks like.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="media-credit">Credit</Label>
        <Input
          id="media-credit"
          value={credit}
          onChange={(event) => onChange({ credit: event.target.value })}
          placeholder="Photographer, where one is owed."
        />
      </div>
    </div>
  );
}
