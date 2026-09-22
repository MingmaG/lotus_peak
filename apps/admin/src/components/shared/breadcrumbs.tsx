'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  /** Omitted on the last crumb, which is where you already are. */
  href?: string;
}

/**
 * Where you are, and the way back.
 *
 * The panel is three levels deep in places — a journey, its itinerary, a day —
 * and the only way back used to be the browser's own button, which is the one
 * control that does not say where it goes. This does.
 *
 * The last crumb carries `aria-current="page"` and no link: a link to the page
 * you are on is a control that does nothing, and a screen reader announcing
 * "link, Jomolhari" for the heading you just landed on is noise.
 *
 * Built per screen rather than derived from the path. A path gives you
 * `/trips/cmub8f…`, and the crumb has to read "Jomolhari" — a title the page
 * has already loaded and the URL has never heard of.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-3 min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
        {items.map((crumb, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
              )}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="truncate rounded-sm px-0.5 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn('truncate px-0.5', last && 'text-foreground')}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
