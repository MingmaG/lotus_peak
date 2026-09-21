'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Lock } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { relativeTime } from '@/lib/format';

interface Row {
  id: string;
  path: string;
  title: string;
  lead: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  isSystem: boolean;
  showInSitemap: boolean;
  sections: unknown[];
  updatedAt: string;
}

/**
 * The pages, as a list rather than a table.
 *
 * There are eleven of them and there will not be many more — they are the
 * site's fixed shape, not a growing collection. A list with the address under
 * the title reads better than seven columns of which four would be empty.
 */
export function PagesList() {
  const { data, isLoading } = useQuery<{ items: Row[] }>({
    queryKey: ['pages'],
    queryFn: () => apiGet('/api/pages'),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No pages"
        description="About, Contact, Terms, Travellers' information, and the words around each index route."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((page) => (
        <li key={page.id}>
          <Link
            href={`/pages/${page.id}`}
            className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {page.title}
                {page.isSystem && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground"
                    title="One of the site's fixed routes. Everything on it can change; its address cannot."
                  >
                    <Lock className="size-3" />
                    fixed route
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <code>{page.path}</code>
                {page.lead ? ` · ${page.lead}` : ''}
              </p>
            </div>

            <span className="shrink-0 text-xs text-muted-foreground">
              {page.sections.length} {page.sections.length === 1 ? 'band' : 'bands'}
            </span>

            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeTime(page.updatedAt)}
            </span>

            <StatusBadge status={page.status} className="shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
