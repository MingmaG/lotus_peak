'use client';

import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Ticking which pages in another section this one links to.
 *
 * Checkboxes rather than a combobox, because the lists are short — six valleys
 * and their places, eight culture pieces — and seeing all of them at once is
 * how an editor notices the one they forgot. A filter appears when a list
 * outgrows a screen.
 *
 * The order of the ticks is the order the links render in, so a newly ticked
 * item goes to the end rather than jumping to its position in the list.
 */

export interface LinkOption {
  id: string;
  label: string;
  /** Indents the row under the one before it: a place under its valley. */
  nested?: boolean;
  /** Shown beside a row the website does not show yet. */
  draft?: boolean;
}

export function LinkPicker({
  options,
  value,
  onChange,
  empty,
}: {
  options: LinkOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  const [filter, setFilter] = React.useState('');
  const shown = filter
    ? options.filter((option) => option.label.toLowerCase().includes(filter.toLowerCase()))
    : options;

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {options.length > 12 && (
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter…"
          className="max-w-xs"
        />
      )}
      {/* One column. Two flowed the rows across, and a place landed beside —
          or under — the wrong valley. */}
      <ul className="grid gap-1.5">
        {shown.map((option) => (
          <li key={option.id} className={cn(option.nested && !filter && 'pl-6')}>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.includes(option.id)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              />
              <span className={cn(option.nested && 'text-muted-foreground')}>
                {option.nested && <span aria-hidden="true">↳ </span>}
                {option.label}
              </span>
              {option.draft && (
                <span className="rounded bg-muted px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Not published
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
