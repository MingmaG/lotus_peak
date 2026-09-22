'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A box that reads dollars and reports cents.
 *
 * The database holds minor units and the office types "4500.00", so somewhere
 * has to convert. Doing it here, once, is what stops a `* 100` appearing in
 * nine call sites with one of them written as `/ 100` on a tired afternoon.
 *
 * ## It keeps the text somebody typed
 *
 * The displayed value is state, not `cents / 100` re-rendered on every
 * keystroke. Deriving it means that typing "45.10" reformats to "45.1" the
 * moment the zero lands, and that typing "." into an empty box produces "0."
 * with the caret in the wrong place. Both are the kind of fault that makes a
 * form feel broken without producing a wrong number, which is why it is worth
 * the extra state.
 *
 * The conversion rounds, because `4.10 * 100` is `409.99999999999994` in
 * binary floating point and `Math.trunc` of that is 409 — a cent lost, on
 * every price ending in 10p, silently.
 */
export function MoneyInput({
  cents,
  onCents,
  placeholder,
  disabled,
  className,
  id,
}: {
  cents: number;
  onCents: (next: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [text, setText] = React.useState(() => toText(cents));

  /* Re-sync when the value changes underneath — a coupon applied, a price
     filled in from the journey — but not while this box has the caret, or a
     round-trip through the parent would rewrite what is being typed. */
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setText(toText(cents));
  }, [cents]);

  return (
    <Input
      id={id}
      inputMode="decimal"
      value={text}
      disabled={disabled}
      placeholder={placeholder ?? '0.00'}
      className={cn('tabular-nums', className)}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(toText(cents));
      }}
      onChange={(event) => {
        const raw = event.target.value;
        /* Digits, one point, two places. Rejecting the keystroke rather than
           correcting it afterwards: a box that silently rewrites what you
           typed is a box you stop trusting. */
        if (raw !== '' && !/^\d*\.?\d{0,2}$/.test(raw)) return;
        setText(raw);
        const parsed = Number.parseFloat(raw);
        onCents(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
      }}
    />
  );
}

function toText(cents: number): string {
  return (cents / 100).toFixed(2);
}
