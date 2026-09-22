import { cn } from '@/lib/utils';
import type { PaymentState } from '@/server/services/booking';
import { BOOKING_STATUS, PAYMENT_STATE, PAYMENT_STATUS } from './labels';

/**
 * A dot and a word, following `StatusBadge`.
 *
 * Not a coloured pill, for the reason given there: on a table of forty
 * bookings, forty pills make the status the loudest thing on the screen and
 * the travellers' names the quietest.
 *
 * The five existing status colours are reused rather than five new ones being
 * invented. A booking that is `CONFIRMED` is the same green as a page that is
 * published, because both mean "this is real now", and a panel where green
 * means one thing on one screen and another elsewhere is a panel nobody reads
 * at a glance.
 */

const BOOKING_DOT: Record<string, string> = {
  DRAFT: 'bg-status-draft',
  PROVISIONAL: 'bg-status-scheduled',
  CONFIRMED: 'bg-status-published',
  COMPLETED: 'bg-status-archived',
  CANCELLED: 'bg-status-attention',
};

export function BookingStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs', className)}>
      <span
        className={cn('size-1.5 shrink-0 rounded-full', BOOKING_DOT[status] ?? 'bg-status-draft')}
        aria-hidden
      />
      {BOOKING_STATUS[status] ?? status}
    </span>
  );
}

const PAYMENT_DOT: Record<PaymentState, string> = {
  UNPAID: 'bg-status-attention',
  PART_PAID: 'bg-status-scheduled',
  PAID: 'bg-status-published',
  OVERPAID: 'bg-status-attention',
  REFUNDED: 'bg-status-archived',
};

export function PaymentStateBadge({
  state,
  className,
}: {
  state: PaymentState;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', PAYMENT_DOT[state])} aria-hidden />
      {PAYMENT_STATE[state]}
    </span>
  );
}

const TRANSACTION_DOT: Record<string, string> = {
  PENDING: 'bg-status-scheduled',
  COMPLETED: 'bg-status-published',
  FAILED: 'bg-status-attention',
  CANCELLED: 'bg-status-archived',
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs', className)}>
      <span
        className={cn('size-1.5 shrink-0 rounded-full', TRANSACTION_DOT[status] ?? 'bg-status-draft')}
        aria-hidden
      />
      {PAYMENT_STATUS[status] ?? status}
    </span>
  );
}
