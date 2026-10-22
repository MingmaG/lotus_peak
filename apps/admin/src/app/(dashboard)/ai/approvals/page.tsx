import { Bot, CheckCircle2 } from 'lucide-react';

import { ApprovalActions } from '@/components/ai/approval-actions';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatDateTime, relativeTime } from '@/lib/format';
import { expireStaleApprovals } from '@/server/mcp/approvals';

export const metadata = { title: 'AI approvals' };
export const dynamic = 'force-dynamic';

const RISK_TONE = {
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'destructive',
} as const;

const STATUS_TONE = {
  PENDING: 'info',
  EXECUTING: 'info',
  COMPLETED: 'success',
  REJECTED: 'muted',
  EXPIRED: 'muted',
  FAILED: 'destructive',
} as const;

/**
 * What an AI asked for, waiting on a person.
 *
 * Each card says what would change, field by field, before and after — the
 * record as it was when the request was made. If somebody has changed that
 * record since, approving is refused rather than carried out over their edit,
 * and the card says so.
 */
export default async function ApprovalsPage() {
  const user = await requirePermission('ai.read');
  await expireStaleApprovals();

  const include = {
    requestedBy: { select: { name: true } },
    approvedBy: { select: { name: true } },
    rejectedBy: { select: { name: true } },
  } as const;

  const [pending, decided] = await Promise.all([
    db.mcpApproval.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, include }),
    db.mcpApproval.findMany({
      where: { status: { not: 'PENDING' } },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include,
    }),
  ]);

  const mayDecide = can(user.permissions, 'ai.publish');

  return (
    <>
      <PageHeader
        title="AI approvals"
        description="What an AI client asked to do that waits for a person: publishing, prices, deleting, and any change to something already on the website. Nothing here has happened yet."
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing is waiting"
          description="When an AI asks for something that needs a person, it appears here with exactly what would change."
        />
      ) : (
        <div className="space-y-4">
          {pending.map((approval) => (
            <Card key={approval.id} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{approval.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Asked by {approval.requestedBy.name} through {approval.requestedVia},{' '}
                    {relativeTime(approval.createdAt)} · expires {formatDateTime(approval.expiresAt)} ·{' '}
                    <code>{approval.toolName}</code> · needs <code>{approval.permission}</code>
                  </p>
                </div>
                <Badge variant={RISK_TONE[approval.risk]} className="shrink-0">{approval.risk.toLowerCase()} risk</Badge>
              </div>

              <Changes changes={approval.proposedChanges} />

              {mayDecide ? (
                can(user.permissions, approval.permission as never) ? (
                  <ApprovalActions id={approval.id} />
                ) : (
                  <p className="text-right text-xs text-muted-foreground">
                    Deciding this needs <code>{approval.permission}</code>, which your account does not hold.
                  </p>
                )
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recently decided</h2>
          <Card className="divide-y p-0">
            {decided.map((approval) => (
              <div key={approval.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p>{approval.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {approval.requestedBy.name} via {approval.requestedVia} · {formatDateTime(approval.createdAt)}
                    {approval.approvedBy && ` · approved by ${approval.approvedBy.name}`}
                    {approval.rejectedBy && ` · rejected by ${approval.rejectedBy.name}`}
                    {approval.rejectionReason && `: “${approval.rejectionReason}”`}
                    {approval.errorMessage && ` · ${approval.errorMessage}`}
                  </p>
                </div>
                <Badge variant={STATUS_TONE[approval.status]} className="shrink-0">{approval.status.toLowerCase()}</Badge>
              </div>
            ))}
          </Card>
        </section>
      )}

      {pending.length === 0 && decided.length === 0 && (
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="size-3.5" /> No AI client has asked for anything yet.
        </p>
      )}
    </>
  );
}

/** Before and after, a row a field. Long values scroll in their own box. */
function Changes({ changes }: { changes: unknown }) {
  const entries = Object.entries((changes ?? {}) as Record<string, { from: unknown; to: unknown }>);
  if (entries.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Now</th>
            <th className="px-3 py-2 font-medium">Would become</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map(([field, change]) => (
            <tr key={field} className="align-top">
              <td className="whitespace-nowrap px-3 py-2 font-medium">{field}</td>
              <td className="px-3 py-2 text-muted-foreground">
                <Value value={change.from} />
              </td>
              <td className="px-3 py-2">
                <Value value={change.to} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Value({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="italic">empty</span>;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <pre className="max-h-48 max-w-md overflow-auto whitespace-pre-wrap break-words font-sans">{text}</pre>;
}
