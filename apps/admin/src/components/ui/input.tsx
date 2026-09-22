import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-input bg-background flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]',
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'dark:bg-input/30',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
