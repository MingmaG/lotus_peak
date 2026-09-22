'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon, MinusIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A checkbox. Checked is a green box with a white tick, in both themes.
 *
 * Two things here are deliberate, and both were bugs in the dark theme.
 *
 * **The checked state names its own dark colour.** `dark:bg-input/30` tints the
 * empty box, and every class in this list is a single class — same specificity —
 * so which one wins is source order in the generated stylesheet, and the `dark:`
 * variant came out last. A checked box in dark mode was therefore painting the
 * *unchecked* tint: a barely-visible 4% white chip, with the tick nearly
 * invisible on it. `dark:data-[state=checked]:` says it at the same weight, so
 * the checked state wins because it is more specific about when it applies
 * rather than by luck.
 *
 * **It is `primary-solid`, not `primary`.** The dark theme's `--primary` is
 * tuned to carry near-black text on a button, which on a 16px control reads as
 * a pale mint chip with a dark scratch in it. `--primary-solid` is dark enough
 * in both themes to take a white mark — see the note beside it in globals.css.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer border-input dark:bg-input/30 size-4 shrink-0 rounded-[4px] border shadow-xs outline-none transition-shadow',
        'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary-solid data-[state=checked]:border-primary-solid data-[state=checked]:text-primary-solid-foreground',
        'dark:data-[state=checked]:bg-primary-solid dark:data-[state=checked]:border-primary-solid dark:data-[state=checked]:text-primary-solid-foreground',
        'data-[state=indeterminate]:bg-primary-solid data-[state=indeterminate]:border-primary-solid data-[state=indeterminate]:text-primary-solid-foreground',
        'dark:data-[state=indeterminate]:bg-primary-solid dark:data-[state=indeterminate]:border-primary-solid dark:data-[state=indeterminate]:text-primary-solid-foreground',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        {props.checked === 'indeterminate' ? (
          <MinusIcon className="size-3.5" />
        ) : (
          <CheckIcon className="size-3.5" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
