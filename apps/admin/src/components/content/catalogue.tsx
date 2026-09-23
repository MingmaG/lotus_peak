'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { EditorPage } from '@/components/shared/editor-page';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { SortableList } from '@/components/shared/sortable-list';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError, apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import type { ContentStatus } from '@prisma/client';

/**
 * A reorderable list, and an editor on a page of its own.
 *
 * Destinations, activities, culture pieces, reflections and people all work
 * this way, and they work this way because of what they are: six to thirty
 * rows whose *order* is as much of the editorial decision as the words, so the
 * list stays draggable and stays one screen.
 *
 * What changed is where the editing happens. It used to be a sheet sliding in
 * from the right — 512 pixels holding a rich-text editor, a photograph picker
 * and a list of journeys, none of which fit. It is a page now, with an address
 * and a back button. See `EditorPage`.
 *
 * One config object describes a type, and both halves read it: the list knows
 * how to draw a row, the editor knows how to draw a form. That is the line
 * between them — every one of these needs the same list, the same save and the
 * same delete, and none of them needs the same fields.
 */

export interface CatalogueRow {
  id: string;
  status?: ContentStatus;
  [key: string]: unknown;
}

/** What the list half needs. Where we go and Culture use only this. */
export interface CatalogueListConfig<T extends CatalogueRow> {
  /** `/api/destinations`. Items come from GET, order goes back on PATCH. */
  endpoint: string;
  /** `/destinations`. The list page, and the stem of every row's address. */
  basePath: string;
  /** React Query key root. */
  queryKey: string;

  /** What this screen is called, for the heading and the breadcrumb. */
  title: string;
  description?: string;

  /** The heading each row shows, and its second line. */
  primary: (row: T) => string;
  secondary?: (row: T) => React.ReactNode;
  thumbnail?: (row: T) => string | null;

  /**
   * Which rows this list shows. Where we go shows the valleys; a valley's
   * places are listed on the valley's own page. Hidden rows keep their order
   * and are left alone by a drag here.
   */
  show?: (row: T) => boolean;

  /** Whether there is an Add button. */
  canAdd: boolean;
  addLabel?: string;
  emptyTitle: string;
  emptyDescription: string;

  /** False where the type has a fixed membership — the four seasons. */
  reorderable?: boolean;

  /**
   * What a row does, for the label on it. "Open" where a row leads to the
   * record's page and editing is a button there — Where we go, Culture.
   */
  rowAction?: 'Edit' | 'Open';
}

export interface CatalogueConfig<T extends CatalogueRow, TForm>
  extends Omit<CatalogueListConfig<T>, 'canAdd'> {
  /** A blank form, for Add. Null hides the Add button. */
  blank: (() => TForm) | null;
  toForm: (row: T) => TForm;
  toBody: (form: TForm) => unknown;
  renderForm: (form: TForm, set: (patch: Partial<TForm>) => void) => React.ReactNode;
  editTitle: (form: TForm) => string;
}

/* -------------------------------------------------------------------------- */
/*  The list                                                                   */
/* -------------------------------------------------------------------------- */

export function CatalogueList<T extends CatalogueRow>({
  config,
  canWrite,
}: {
  config: CatalogueListConfig<T>;
  canWrite: boolean;
}) {
  const client = useQueryClient();
  const reorderable = config.reorderable ?? true;

  const { data, isLoading } = useQuery<{ items: T[] }>({
    queryKey: [config.queryKey],
    queryFn: () => fetch(config.endpoint).then((response) => response.json()),
  });

  const all = data?.items ?? [];
  const items = config.show ? all.filter(config.show) : all;

  const reorder = useMutation({
    mutationFn: (ids: string[]) => apiPatch(config.endpoint, { ids }),
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
      void client.invalidateQueries({ queryKey: [config.queryKey] });
    },
  });

  const addButton = canWrite && config.canAdd && (
    <Button asChild>
      <Link href={`${config.basePath}/new`}>
        <Plus className="mr-1.5 size-4" />
        {config.addLabel ?? 'Add'}
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <>
        <PageHeader title={config.title} description={config.description} />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={addButton}
      />

      {items.length === 0 ? (
        <EmptyState
          title={config.emptyTitle}
          description={config.emptyDescription}
          action={addButton || undefined}
        />
      ) : (
        <SortableList
          items={items}
          itemKey={(row) => row.id}
          onChange={(next) => {
            /* Optimistic: the cache is rewritten first so the drag lands where
               it was dropped, and the request follows. Rows this list does
               not show stay in the cache after the ones it does. */
            const hidden = all.filter((row) => !next.includes(row));
            client.setQueryData([config.queryKey], { items: [...next, ...hidden] });
            if (reorderable) reorder.mutate(next.map((row) => row.id));
          }}
          disabled={!canWrite || !reorderable}
          describeItem={(row) => config.primary(row)}
          renderItem={(row) => (
            <Link
              href={`${config.basePath}/${row.id}`}
              className="group flex w-full items-center gap-4 text-left"
            >
              {config.thumbnail && (
                /**
                 * Big enough to recognise the photograph.
                 *
                 * This was 48 pixels square, which is a colour swatch rather
                 * than a picture — an editor scanning for "the one with the
                 * prayer flags" could not tell two of them apart.
                 */
                <span className="size-20 shrink-0 overflow-hidden rounded-md border bg-muted sm:size-24">
                  {config.thumbnail(row) && (
                    <img
                      src={config.thumbnail(row)!}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  )}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium group-hover:underline">
                  {config.primary(row)}
                </span>
                {config.secondary && (
                  <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">
                    {config.secondary(row)}
                  </span>
                )}
              </span>

              {row.status && <StatusBadge status={row.status} className="shrink-0" />}

              {canWrite && (
                <span className="hidden shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground sm:inline-flex">
                  {config.rowAction === 'Open' ? (
                    <ArrowRight className="size-3.5" />
                  ) : (
                    <Pencil className="size-3.5" />
                  )}
                  {config.rowAction ?? 'Edit'}
                </span>
              )}
            </Link>
          )}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  The editor                                                                 */
/* -------------------------------------------------------------------------- */

export function CatalogueEditor<T extends CatalogueRow, TForm>({
  config,
  id,
  canWrite,
  canDelete,
}: {
  config: CatalogueConfig<T, TForm>;
  /** The row's id, or null for a new one. */
  id: string | null;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = React.useState<TForm | null>(null);

  const { data, isLoading } = useQuery<{ items: T[] }>({
    queryKey: [config.queryKey],
    queryFn: () => fetch(config.endpoint).then((response) => response.json()),
  });

  /**
   * The row is found in the list rather than fetched on its own.
   *
   * These endpoints return six to thirty rows with everything on them, the
   * list is almost always already in the cache from the screen the editor was
   * opened from, and a second endpoint per type would be five more routes that
   * can disagree with the first five.
   */
  const row = id ? data?.items.find((item) => item.id === id) : undefined;

  React.useEffect(() => {
    if (form !== null) return;
    if (id === null && config.blank) setForm(config.blank());
    else if (row) setForm(config.toForm(row));
  }, [row, id, config, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const body = config.toBody(form);
      return id ? apiPatch(`${config.endpoint}/${id}`, body) : apiPost(config.endpoint, body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [config.queryKey] });
      toast.success('Saved');
      router.push(config.basePath);
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiClientError && error.fields
          ? (Object.values(error.fields)[0] ?? error.message)
          : error.message,
      );
    },
  });

  const destroy = useMutation({
    mutationFn: () => apiDelete(`${config.endpoint}/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [config.queryKey] });
      toast.success('Removed');
      router.push(config.basePath);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !form) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (id !== null && !row) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          title="Not here any more"
          description="This was removed, or the address is wrong."
          action={
            <Button asChild variant="outline">
              <Link href={config.basePath}>Back to {config.title.toLowerCase()}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const title = config.editTitle(form);

  return (
    <EditorPage
      title={title}
      crumbs={[
        { label: config.title, href: config.basePath },
        { label: id === null ? `New ${config.title.toLowerCase()}` : title },
      ]}
      backHref={config.basePath}
      onSave={() => save.mutate()}
      isSaving={save.isPending}
      canSave={canWrite}
      {...(id !== null && canDelete ? { onDelete: () => destroy.mutate() } : {})}
    >
      <div className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="space-y-5">
          {config.renderForm(form, (patch) =>
            setForm((current) => (current ? { ...current, ...patch } : current)),
          )}
        </div>
      </div>
    </EditorPage>
  );
}

/* -------------------------------------------------------------------------- */
/*  The screen                                                                 */
/* -------------------------------------------------------------------------- */

export interface CatalogueScreenProps<T extends CatalogueRow, TForm>
  extends CatalogueConfig<T, TForm> {
  canWrite: boolean;
  canDelete: boolean;
  /**
   * Which of the two screens this is.
   *
   * `undefined` is the list. A string is that row's editor, and `null` is the
   * editor for a row that does not exist yet. Three states rather than two
   * because "no id" and "not editing" are different things, and a boolean
   * beside an id is a pair that can contradict itself.
   */
  editId?: string | null;
}

/**
 * One component, two screens, so a type is described in one place.
 *
 * Each catalogue — destinations, activities, culture, reflections, people —
 * is a single file holding its fields and its labels, and the route decides
 * which half of it to draw. Splitting them into a list file and an editor file
 * would mean `toForm` and `renderForm` living apart from the `Row` they agree
 * about, which is how the two drift.
 */
export function CatalogueScreen<T extends CatalogueRow, TForm>({
  canWrite,
  canDelete,
  editId,
  ...config
}: CatalogueScreenProps<T, TForm>) {
  if (editId === undefined) {
    return (
      <CatalogueList config={{ ...config, canAdd: config.blank !== null }} canWrite={canWrite} />
    );
  }
  return (
    <CatalogueEditor
      config={config}
      id={editId}
      canWrite={canWrite}
      canDelete={canDelete}
    />
  );
}
