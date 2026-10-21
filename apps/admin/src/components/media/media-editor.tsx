'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { MediaDetailsFields } from './media-picker';
import { EditorPage } from '@/components/shared/editor-page';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiDelete, apiPatch } from '@/lib/api-client';
import { fileSize, formatDate } from '@/lib/format';

export interface MediaEditorData {
  id: string;
  url: string;
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
 * One photograph, on a page of its own.
 *
 * It was a sheet over the library, which put the focal-point control — the
 * one thing here that needs the photograph large — in a 512 pixel column. The
 * page also says where the photograph is used, which is the question somebody
 * deleting it needs answered before they press the button, not after.
 *
 * `backHref` carries the library's filters, so working through the "Needs a
 * description" backlog comes back to the backlog rather than to everything.
 */
export function MediaEditor({
  media,
  uses,
  backHref,
  canWrite,
  canDelete,
}: {
  media: MediaEditorData;
  uses: { total: number; where: string[] };
  backHref: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft] = React.useState<Partial<MediaEditorData>>({});
  const current = { ...media, ...draft };

  const save = useMutation({
    mutationFn: () => apiPatch(`/api/media/${media.id}`, draft),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['media'] });
      toast.success('Saved');
      router.push(backHref);
      /* The server component above this read the row; without a refresh a
         second visit would open on the values from before the save. */
      router.refresh();
    },
    onError: (error: Error) =>
      toast.error(
        error instanceof ApiClientError && error.fields
          ? (Object.values(error.fields)[0] ?? error.message)
          : error.message,
      ),
  });

  const destroy = useMutation({
    mutationFn: () => apiDelete(`/api/media/${media.id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['media'] });
      toast.success('Deleted');
      router.push(backHref);
    },
    /* A 409 here is the useful case: the message names where it is used. */
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  return (
    <EditorPage
      title={current.filename}
      description={
        current.width && current.height
          ? `${current.width} × ${current.height} · ${fileSize(current.sizeBytes)} · ${current.renditionCount} renditions · added ${formatDate(current.createdAt)}`
          : fileSize(current.sizeBytes)
      }
      crumbs={[{ label: 'Media library', href: backHref }, { label: current.filename }]}
      backHref={backHref}
      onSave={() => save.mutate()}
      isSaving={save.isPending}
      canSave={canWrite && Object.keys(draft).length > 0}
      /* No Delete while it is in use: the API would refuse it with a 409, and
         the box below already says why and what to do instead. */
      onDelete={canDelete && uses.total === 0 ? () => destroy.mutate() : undefined}
      deleteLabel="Delete"
      deleteDescription="The photograph and every size built from it will be removed. This cannot be undone."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FocalPicker
          url={current.url}
          x={current.focalX}
          y={current.focalY}
          disabled={!canWrite}
          onChange={(focalX, focalY) => setDraft((value) => ({ ...value, focalX, focalY }))}
        />

        <div className="space-y-6">
          <MediaDetailsFields
            alt={current.alt}
            isDecorative={current.isDecorative}
            caption={current.caption ?? ''}
            credit={current.credit ?? ''}
            onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))}
          />

          <div className="space-y-1 rounded-lg border p-3">
            <Label>Where it is used</Label>
            <p className="text-sm text-muted-foreground">
              {uses.total === 0
                ? 'Nowhere yet.'
                : `${uses.total} ${uses.total === 1 ? 'place' : 'places'}: ${uses.where.join(', ')}.`}
              {uses.total > 0 && canDelete && ' Take it off those before it can be deleted.'}
            </p>
          </div>
        </div>
      </div>
    </EditorPage>
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
