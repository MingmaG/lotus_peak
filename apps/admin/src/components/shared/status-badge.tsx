import type { ContentStatus } from '@prisma/client';

import { cn } from '@/lib/utils';

/**
 * Draft · Scheduled · Published · Archived.
 *
 * A dot and a word, not a coloured pill. On a table of forty rows, forty
 * coloured pills is a table where the status is the loudest thing on it and
 * the titles are not.
 */
const LABEL: Record<ContentStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const DOT: Record<ContentStatus, string> = {
  DRAFT: 'bg-status-draft',
  SCHEDULED: 'bg-status-scheduled',
  PUBLISHED: 'bg-status-published',
  ARCHIVED: 'bg-status-archived',
};

export function StatusBadge({
  status,
  className,
}: {
  status: ContentStatus;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span className={cn('size-1.5 rounded-full', DOT[status])} aria-hidden />
      {LABEL[status]}
    </span>
  );
}
