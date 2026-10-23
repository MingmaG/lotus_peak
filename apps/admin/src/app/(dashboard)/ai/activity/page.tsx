import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata = { title: 'AI activity' };
export const dynamic = 'force-dynamic';

const STATUSES = ['SUCCESS', 'APPROVAL_REQUIRED', 'DENIED', 'REJECTED', 'FAILED'] as const;

const TONE = {
  SUCCESS: 'success',
  APPROVAL_REQUIRED: 'info',
  DENIED: 'destructive',
  REJECTED: 'muted',
  FAILED: 'warning',
} as const;

/**
 * Every call an AI client made, the refused ones included.
 *
 * The Activity screen records what changed; this records what was *asked*. A
 * refused write never reaches the Activity screen, and after a surprise it is
 * often the line worth reading. Read-only, like every audit log.
 */
export default async function AiActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePermission('ai.read');
  const { status } = await searchParams;
  const filter = STATUSES.find((one) => one === status);

  const rows = await db.mcpAuditLog.findMany({
    where: filter ? { status: filter } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="AI activity"
        description="Every call an AI client has made — what it asked for, as whom, and how it ended, refusals included. The newest two hundred."
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {[undefined, ...STATUSES].map((one) => (
          <Link
            key={one ?? 'all'}
            href={one ? `/ai/activity?status=${one}` : '/ai/activity'}
            className={cn(
              'rounded-full border px-3 py-1',
              filter === one ? 'bg-foreground text-background' : 'hover:bg-muted',
            )}
          >
            {one ? one.toLowerCase().replace('_', ' ') : 'everything'}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <Card className="divide-y p-0">
          {rows.map((row) => (
            <details key={row.id} className="group px-4 py-2.5 text-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <code className="text-[13px]">{row.tool}</code>
                  {row.entityLabel && <span className="text-muted-foreground"> · {row.entityLabel}</span>}
                  <span className="block text-xs text-muted-foreground">
                    {row.user?.name ?? 'unknown'} via {row.clientLabel ?? 'an AI client'} · {formatDateTime(row.createdAt)}
                    {row.durationMs !== null && ` · ${row.durationMs} ms`}
                    {row.errorCode && ` · ${row.errorCode}`}
                  </span>
                </span>
                <Badge variant={TONE[row.status]}>{row.status.toLowerCase().replace('_', ' ')}</Badge>
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted/50 p-3 text-xs whitespace-pre-wrap break-words">
                {JSON.stringify({ arguments: row.arguments, result: row.result }, null, 2)}
              </pre>
            </details>
          ))}
        </Card>
      )}
    </>
  );
}
