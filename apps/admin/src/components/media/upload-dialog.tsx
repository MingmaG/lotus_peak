'use client';

import { useMutation } from '@tanstack/react-query';
import { Loader2, Upload, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import type { PickedMedia } from './media-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fileSize } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Describing photographs on the way in.
 *
 * `schema.prisma` has said for a long time that "the upload form refuses to
 * close without one or the other" — a description, or a decision that the
 * photograph is decorative. There was no such form. Files went straight to the
 * server with the *filename* as the description:
 *
 * ```
 *   form.append('alt', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
 * ```
 *
 * which is a sentence like "IMG 4471" or "punakha dzong 2". That is not a
 * description, and worse, it is not *blank* — so the library's "Needs a
 * description" filter, which looks for an empty `alt`, could not see any of
 * them. Every upload joined a backlog nothing listed.
 *
 * So the description is asked for here, before anything is sent, while the
 * photograph is in front of the person who chose it and knows what is in it.
 * That is the only moment when writing it is cheap; a week later it means
 * opening sixty files to find out what they were.
 *
 * **Nothing is prefilled.** The tidied filename is offered as a placeholder and
 * as a one-click "Use the filename" — an escape hatch for a batch of twenty,
 * which is the case the old comment worried about — but it is never the
 * silent default, because a default nobody sees is how the backlog happened.
 *
 * The other two fields are optional and mean different things: the caption is
 * printed under the photograph for everybody, the description is read by
 * somebody who cannot see it. See `editor/figure.tsx`, which lets a body
 * override both for one particular use of the picture.
 */

interface Row {
  file: File;
  /** An object URL, revoked when the dialog unmounts. */
  preview: string;
  alt: string;
  caption: string;
  credit: string;
  isDecorative: boolean;
}

/** "punakha-dzong_2.webp" → "punakha dzong 2". Offered, never assumed. */
function fromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
}

function describedEnough(row: Row): boolean {
  return row.isDecorative || row.alt.trim().length > 0;
}

export function UploadDialog({
  files,
  onClose,
  onUploaded,
  folderId,
}: {
  /** The chosen files. The dialog is open while this has anything in it. */
  files: File[];
  onClose: () => void;
  /** The uploaded rows, in the order they were chosen. */
  onUploaded: (media: PickedMedia[]) => void;
  folderId?: string | null;
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [done, setDone] = React.useState(0);

  /**
   * Object URLs are created once per set of files and revoked when they are
   * replaced. Without the revoke, dropping four hundred photographs over an
   * afternoon holds every one of them in memory until the tab is closed.
   */
  React.useEffect(() => {
    const next = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      alt: '',
      caption: '',
      credit: '',
      isDecorative: false,
    }));
    setRows(next);
    setDone(0);
    return () => {
      for (const row of next) URL.revokeObjectURL(row.preview);
    };
  }, [files]);

  const patch = (index: number, value: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...value } : row)),
    );

  const upload = useMutation({
    mutationFn: async (toSend: Row[]) => {
      const out: PickedMedia[] = [];
      for (const row of toSend) {
        const form = new FormData();
        form.append('file', row.file);
        form.append('alt', row.isDecorative ? '' : row.alt.trim());
        form.append('isDecorative', String(row.isDecorative));
        if (row.caption.trim()) form.append('caption', row.caption.trim());
        if (row.credit.trim()) form.append('credit', row.credit.trim());
        if (folderId) form.append('folderId', folderId);

        const response = await fetch('/api/media/upload', { method: 'POST', body: form });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          /* Named, because "that upload did not work" over eight files tells
             nobody which one to try again. */
          throw new Error(body?.error?.message ?? `${row.file.name} could not be uploaded.`);
        }
        out.push(((await response.json()) as { media: PickedMedia }).media);
        setDone((n) => n + 1);
      }
      return out;
    },
    onSuccess: (media) => {
      toast.success(
        `${media.length} ${media.length === 1 ? 'photograph' : 'photographs'} uploaded`,
      );
      onUploaded(media);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const undescribed = rows.filter((row) => !describedEnough(row)).length;
  const busy = upload.isPending;

  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={(value) => {
        /* Closing mid-upload would leave half a batch on the server with no
           way back to the rest of it. */
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent
        size="lg"
        className="flex max-h-[min(90dvh,52rem)] flex-col overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>
            {rows.length === 1 ? 'Describe this photograph' : `Describe these ${rows.length}`}
          </DialogTitle>
          <DialogDescription>
            What somebody who cannot see it would need told. It is also what a search
            engine reads, and it is far quicker to write now than to work out from the
            file in a month.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          {rows.map((row, index) => {
            const suggestion = fromFilename(row.file.name);
            return (
              <div
                key={`${row.file.name}-${index}`}
                className={cn(
                  'flex gap-3 rounded-lg border p-3',
                  !describedEnough(row) && 'border-destructive/40 bg-destructive/[0.03]',
                )}
              >
                <div className="w-28 shrink-0 space-y-1.5">
                  {/* The file the person just chose, straight off their disk —
                      nothing has been uploaded yet, so there is no URL to use. */}
                  <img
                    src={row.preview}
                    alt=""
                    className="aspect-4/3 w-full rounded border bg-muted object-cover"
                  />
                  <p className="truncate text-[11px] font-medium" title={row.file.name}>
                    {row.file.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {fileSize(row.file.size)}
                  </p>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <Textarea
                    value={row.alt}
                    onChange={(event) => patch(index, { alt: event.target.value })}
                    disabled={row.isDecorative || busy}
                    rows={2}
                    placeholder={
                      row.isDecorative
                        ? 'Decorative — no description needed'
                        : /* "e.g.", because a placeholder that reads like a
                             finished sentence looks like a field somebody has
                             already filled in. */
                          'e.g. Monks crossing the courtyard at Punakha before the morning session'
                    }
                    aria-label={`Description for ${row.file.name}`}
                    className="resize-none text-sm"
                  />

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={row.isDecorative}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          patch(index, { isDecorative: checked === true })
                        }
                      />
                      Decorative
                    </label>

                    {!row.isDecorative && suggestion && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        className="h-6 px-1.5 text-xs text-muted-foreground"
                        onClick={() => patch(index, { alt: suggestion })}
                      >
                        Use “{suggestion}”
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={row.caption}
                      disabled={busy}
                      onChange={(event) => patch(index, { caption: event.target.value })}
                      placeholder="Caption (optional)"
                      aria-label={`Caption for ${row.file.name}`}
                      className="h-8 text-xs"
                    />
                    <Input
                      value={row.credit}
                      disabled={busy}
                      onChange={(event) => patch(index, { credit: event.target.value })}
                      placeholder="Credit (optional)"
                      aria-label={`Credit for ${row.file.name}`}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {!busy && rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    aria-label={`Leave ${row.file.name} out`}
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {busy
              ? `Uploading ${done + 1} of ${rows.length}…`
              : undescribed > 0
                ? `${undescribed} still to describe`
                : `${rows.length} ready`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || rows.length === 0 || undescribed > 0}
              onClick={() => upload.mutate(rows)}
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Upload {rows.length > 1 && rows.length}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
