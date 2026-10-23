'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiPost } from '@/lib/api-client';

interface Outcome {
  status: string;
  message?: string;
  reason?: string;
}

/**
 * Approve or reject, on one card.
 *
 * Rejecting asks for a reason, because the reason goes back to the AI and the
 * AI tells the person who asked — "rejected" with nothing after it reads as a
 * malfunction to everybody downstream.
 */
export function ApprovalActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState('');

  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    try {
      const { outcome } = await apiPost<{ outcome: Outcome }>(`/api/ai/approvals/${id}`, {
        decision,
        ...(decision === 'reject' ? { reason } : {}),
      });
      if (outcome.status === 'completed') toast.success('Approved and done.');
      else if (outcome.status === 'rejected') toast.success('Rejected. The AI will be told why.');
      /* Approved, and then refused by the record — it moved, or the person who
         asked lost the permission. Said in full, because it was not done. */ else
        toast.error(outcome.message ?? `It ended ${outcome.status}.`, { duration: 10_000 });
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message, { duration: 8_000 });
    } finally {
      setBusy(false);
    }
  }

  if (rejecting) {
    return (
      <div className="space-y-2">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why not? The AI passes this on to whoever asked."
          rows={2}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRejecting(false)} disabled={busy}>
            Back
          </Button>
          <Button variant="destructive" size="sm" onClick={() => decide('reject')} disabled={busy}>
            Reject
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => setRejecting(true)} disabled={busy}>
        Reject…
      </Button>
      <Button size="sm" onClick={() => decide('approve')} disabled={busy}>
        Approve
      </Button>
    </div>
  );
}
