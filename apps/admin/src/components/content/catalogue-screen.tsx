'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { SortableList } from '@/components/shared/sortable-list';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError, apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import type { ContentStatus } from '@prisma/client';

/**
 * A reorderable list with an editing sheet beside it.
 *
 * Destinations, activities, culture articles, reflections and people all work
 * this way, and they work this way because of what they are: six to thirty
 * rows, each a paragraph or two, whose *order* is as much of the editorial
 * decision as the words. A page-per-row editor would put a navigation between
 * the office and the thing they are actually doing, which is moving Paro above
 * Thimphu.
 *
 * Journeys, journal entries and pages get their own screens instead, because
 * each of those is an afternoon's work rather than a paragraph.
 *
 * The shell is shared and the form is not: `renderForm` is whatever fields
 * this type has. That is the line between the two — every one of these needs
 * the same list, the same sheet, the same save and the same delete, and none
 * of them needs the same fields.
 */

export interface CatalogueRow {
  id: string;
  status?: ContentStatus;
  [key: string]: unknown;
}

export interface CatalogueScreenProps<T extends CatalogueRow, TForm> {
  /** `/api/destinations`. Items come from GET, order goes back on PATCH. */
  endpoint: string;
  /** React Query key root. */
  queryKey: string;

  /** The heading each row shows, and its second line. */
  primary: (row: T) => React.ReactNode;
  secondary?: (row: T) => React.ReactNode;
  thumbnail?: (row: T) => string | null;

  /** A blank form, for Add. Null hides the Add button. */
  blank: (() => TForm) | null;
  /** An existing row as a form. */
  toForm: (row: T) => TForm;
  /** A form as the request body. */
  toBody: (form: TForm) => unknown;
  renderForm: (form: TForm, set: (patch: Partial<TForm>) => void) => React.ReactNode;

  addLabel?: string;
  editTitle: (form: TForm) => string;
  editDescription?: string;
  emptyTitle: string;
  emptyDescription: string;

  canWrite: boolean;
  canDelete: boolean;
  /** False where the type has a fixed membership — the four seasons. */
  reorderable?: boolean;
}

export function CatalogueScreen<T extends CatalogueRow, TForm>({
  endpoint,
  queryKey,
  primary,
  secondary,
  thumbnail,
  blank,
  toForm,
  toBody,
  renderForm,
  addLabel = 'Add',
  editTitle,
  editDescription,
  emptyTitle,
  emptyDescription,
  canWrite,
  canDelete,
  reorderable = true,
}: CatalogueScreenProps<T, TForm>) {
  const client = useQueryClient();
  const [editing, setEditing] = React.useState<{ id: string | null; form: TForm } | null>(null);

  const { data, isLoading } = useQuery<{ items: T[] }>({
    queryKey: [queryKey],
    queryFn: () => fetch(endpoint).then((response) => response.json()),
  });

  const items = data?.items ?? [];

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const body = toBody(editing.form);
      return editing.id
        ? apiPatch(`${endpoint}/${editing.id}`, body)
        : apiPost(endpoint, body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [queryKey] });
      setEditing(null);
      toast.success('Saved');
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiClientError && error.fields
          ? Object.values(error.fields)[0] ?? error.message
          : error.message,
      );
    },
  });

  const destroy = useMutation({
    mutationFn: (id: string) => apiDelete(`${endpoint}/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [queryKey] });
      setEditing(null);
      toast.success('Removed');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => apiPatch(endpoint, { ids }),
    /**
     * The list is not invalidated on success.
     *
     * The rows are already in the new order on screen — the drag put them
     * there — and refetching would replace them with the server's copy a
     * moment later, which reads as a flicker and occasionally as a row
     * snapping back before settling.
     */
    onError: (error: Error) => {
      toast.error(`Could not save the new order: ${error.message}`);
      void client.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            canWrite && blank ? (
              <Button onClick={() => setEditing({ id: null, form: blank() })}>
                <Plus className="mr-1.5 size-4" />
                {addLabel}
              </Button>
            ) : undefined
          }
        />
        {renderSheet()}
      </>
    );
  }

  return (
    <>
      <SortableList
        items={items}
        itemKey={(row) => row.id}
        onChange={(next) => {
          /* Optimistic: the cache is rewritten first so the drag lands where
             it was dropped, and the request follows. */
          client.setQueryData([queryKey], { items: next });
          if (reorderable) reorder.mutate(next.map((row) => row.id));
        }}
        disabled={!canWrite || !reorderable}
        describeItem={(row) => String(primary(row))}
        renderItem={(row) => (
          <button
            type="button"
            onClick={() => canWrite && setEditing({ id: row.id, form: toForm(row) })}
            disabled={!canWrite}
            className="flex w-full items-center gap-3 text-left"
          >
            {thumbnail && (
              <span className="size-12 shrink-0 overflow-hidden rounded bg-muted">
                {thumbnail(row) && (
                  <img
                    src={thumbnail(row)!}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                )}
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{primary(row)}</span>
              {secondary && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {secondary(row)}
                </span>
              )}
            </span>

            {row.status && <StatusBadge status={row.status} className="shrink-0" />}
          </button>
        )}
      />

      {canWrite && blank && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setEditing({ id: null, form: blank() })}
        >
          <Plus className="mr-1.5 size-3.5" />
          {addLabel}
        </Button>
      )}

      {renderSheet()}
    </>
  );

  function renderSheet() {
    return (
      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle>{editTitle(editing.form)}</SheetTitle>
                {editDescription && <SheetDescription>{editDescription}</SheetDescription>}
              </SheetHeader>

              <div className="flex-1 space-y-4 py-4">
                {renderForm(editing.form, (patch) =>
                  setEditing((current) =>
                    current ? { ...current, form: { ...current.form, ...patch } } : current,
                  ),
                )}
              </div>

              <SheetFooter className="flex-row justify-between gap-2 border-t pt-4">
                {editing.id && canDelete ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm('Remove this? It will come off the website.')) {
                        destroy.mutate(editing.id!);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 size-4" />
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
    );
  }
}
