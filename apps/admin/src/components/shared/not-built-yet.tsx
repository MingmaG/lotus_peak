import { Construction } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/shared/page-header';

/**
 * A screen that exists and says so.
 *
 * The office asked for the whole shape of the panel to be here — bookings,
 * payments, the rest — so that the navigation is the one they will end up
 * with rather than one that grows under them. These are those screens, and
 * they are deliberately honest: a heading, what the screen will hold, and what
 * has to be built before it can.
 *
 * **Not a mock.** A screen showing invented bookings is worse than an empty
 * one: somebody will read a number off it, and nobody can tell by looking
 * which parts of a panel are real. The test for whether one of these is ready
 * is whether this component is still imported.
 *
 * Each has a permission of its own already, because a role is something the
 * office sets up once and rarely revisits — see the note in `permissions.ts`.
 */
export function NotBuiltYet({
  title,
  description,
  /** What the screen will hold, in the office's own terms. */
  willHold,
  /** What has to exist first. Usually a table and an integration. */
  needs,
}: {
  title: string;
  description: string;
  willHold: string[];
  needs?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} description={description} />

      <div className="rounded-lg border border-dashed p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <Construction className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-4">
            <div>
              <h2 className="text-sm font-medium">Not built yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This screen is in the navigation so the shape of the panel is the one it
                will end up with. It holds nothing, and nothing here is a real number.
              </p>
            </div>

            <div>
              <h3 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                What it will hold
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {willHold.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {needs && (
              <div>
                <h3 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                  What it needs first
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{needs}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
