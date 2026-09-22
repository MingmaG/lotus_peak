import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The heading every screen opens with.
 *
 * `description` is not decoration. Half of these screens are named after a
 * thing the office has never had a word for — "Reflections", "Seasons",
 * "Discovery" — and a sentence under the title is cheaper than training.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-medium tracking-tight sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
