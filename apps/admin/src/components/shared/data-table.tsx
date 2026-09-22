'use client';

import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

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
import { cn } from '@/lib/utils';

/**
 * The list screen.
 *
 * One component for all seventeen of them, because they are the same screen:
 * a search box, a filter or two, rows, and a pager. Seventeen hand-written
 * tables is seventeen places for the mobile layout to be forgotten.
 *
 * ## It becomes cards under 768 px
 *
 * Not a horizontal scroller. The office answers enquiries from a phone, and a
 * table in a scroller is a table where the column you need is always off the
 * right-hand edge. Each column declares a `label`, which becomes the label
 * beside its value in the card layout, and a `primary` column becomes the
 * card's heading.
 *
 * ## Columns declare their own priority
 *
 * `hideBelow` drops a column at a breakpoint rather than shrinking it. Six
 * columns squeezed into a tablet is six unreadable ones; four legible columns
 * and two in the card view is the better trade, and the component cannot make
 * that judgement — the screen can.
 */

export interface Column<T> {
  key: string;
  label: string;
  /** The card view's heading, and the column that carries the link. */
  primary?: boolean;
  /** `md` hides it below 768 px, `lg` below 1024 px. */
  hideBelow?: 'md' | 'lg';
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
  /** Sortable by this key, server-side. */
  sortKey?: string;
}

export interface Filter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Where clicking a row goes. Omit for a table that is not navigable. */
  href?: (row: T) => string;
  loading?: boolean;
  empty?: React.ReactNode;

  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;

  filters?: Filter[];
  filterValues?: Record<string, string>;
  onFilter?: (key: string, value: string) => void;

  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;

  sort?: string;
  direction?: 'asc' | 'desc';
  onSort?: (key: string) => void;

  /** Rendered between the filters and the table — a bulk action bar, usually. */
  toolbar?: React.ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  href,
  loading,
  empty,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  filters = [],
  filterValues = {},
  onFilter,
  page,
  totalPages,
  total,
  onPage,
  sort,
  direction,
  onSort,
  toolbar,
}: DataTableProps<T>) {
  /**
   * The search box is uncontrolled between keystrokes and debounced.
   *
   * A controlled input that fires a request per character makes the field feel
   * laggy on a slow connection — the value lands, the request returns, and
   * React re-renders it mid-word. This keeps the typing local and tells the
   * parent 300 ms after somebody stops.
   */
  const [draft, setDraft] = React.useState(search);
  React.useEffect(() => setDraft(search), [search]);

  React.useEffect(() => {
    if (draft === search) return;
    const timer = setTimeout(() => onSearch(draft), 300);
    return () => clearTimeout(timer);
  }, [draft, search, onSearch]);

  const visible = (column: Column<T>) =>
    cn(
      column.hideBelow === 'md' && 'hidden md:table-cell',
      column.hideBelow === 'lg' && 'hidden lg:table-cell',
      column.align === 'right' && 'text-right',
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8.5"
            aria-label={searchPlaceholder}
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear the search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {filters.map((filter) => (
          <Select
            key={filter.key}
            value={filterValues[filter.key] ?? 'all'}
            onValueChange={(value) => onFilter?.(filter.key, value)}
          >
            <SelectTrigger className="sm:w-44" aria-label={filter.label}>
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filter.label}: all</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {toolbar}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="hidden md:table-header-group">
            <tr className="border-b bg-muted/40 text-left">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                    visible(column),
                  )}
                >
                  {column.sortKey && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.sortKey!)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {sort === column.sortKey && (
                        <span aria-hidden>{direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y max-md:flex max-md:flex-col max-md:gap-3 max-md:divide-y-0 max-md:p-3">
            {loading &&
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="lp-table-card">
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-4 py-3', visible(column))}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  {empty ?? (
                    <span className="text-sm text-muted-foreground">Nothing here yet.</span>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="lp-table-card group transition-colors hover:bg-muted/40"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      data-label={column.label}
                      className={cn('px-4 py-3 align-middle', visible(column))}
                    >
                      {column.primary && href ? (
                        <Link
                          href={href(row)}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {column.render(row)}
                        </Link>
                      ) : (
                        column.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? 'Nothing to show'
            : `${total} ${total === 1 ? 'item' : 'items'}${
                totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''
              }`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPage(page + 1)}
              disabled={page >= totalPages}
            >
              <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
