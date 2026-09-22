import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

/**
 * What a screen shows before there is anything on it.
 *
 * Always says what the thing *is* and offers the action, because the first
 * time anybody opens "Reflections" there are none, and a blank panel with the
 * word "Reflections" at the top of it teaches nobody anything.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
      {Icon && <Icon className="mb-4 size-8 text-muted-foreground/60" aria-hidden />}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
