'use client';

import { AlertTriangle, Check } from 'lucide-react';
import * as React from 'react';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * What a crawler is told about this page, and what the office can add to it.
 *
 * Structured data was invisible in this panel. The site has emitted a full
 * `@graph` on every page since it was built — the organisation, the website,
 * the page, its breadcrumb trail, and whatever entity the page is *about* —
 * but nobody working here could see that, which meant nobody could tell
 * whether it was right, and the one field that let them add to it
 * (`schemaJson`) had no control anywhere.
 *
 * So this screen does two things:
 *
 * - **Says what is already there.** Not a preview of the JSON, which would be
 *   four hundred lines of it and is the browser's job to show. A list of what
 *   is emitted and one line on each, so somebody can answer "is this page
 *   described as a journey or as an article".
 * - **Takes what is not.** A festival departure as an `Event`, a film as a
 *   `VideoObject` — things the builders here do not cover. It is appended to
 *   the graph, never merged over it: two `TouristTrip` nodes for one journey
 *   is two answers to the same question.
 */

/** The nodes every page emits, whatever it is. */
const ALWAYS: [string, string][] = [
  ['TravelAgency', 'Who publishes this — the name, address, telephone and social profiles from Company.'],
  ['WebSite', 'The site itself, and the search action.'],
  ['WebPage', 'This page: its address, title and description.'],
  ['BreadcrumbList', 'Where it sits, which is what a search result shows above the title.'],
];

export type StructuredDataKind = 'trip' | 'post' | 'page' | 'destination' | 'culture';

const ENTITY: Record<StructuredDataKind, [string, string][]> = {
  trip: [
    ['TouristTrip', 'The journey: its itinerary, what is included, and the price as an AggregateOffer.'],
    ['FAQPage', 'Only the questions this page actually shows. Answers a visitor cannot see are not described.'],
  ],
  post: [
    [
      'Article',
      'The entry: when it was published, who wrote it, its photograph, and the places and culture it is about.',
    ],
  ],
  destination: [
    [
      'TouristDestination',
      'A valley, with its coordinates, its places as attractions, and the journal entries about it. A place inside a valley is a TouristAttraction contained in it.',
    ],
  ],
  culture: [['Article', 'The piece, and the places it can be seen.']],
  page: [],
};

function parse(value: string): { ok: true; nodes: number } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, nodes: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'That is not JSON.' };
  }

  const nodes = Array.isArray(parsed) ? parsed : [parsed];
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return { ok: false, message: 'Each entry has to be an object — { "@type": … }.' };
    }
    if (!('@type' in node)) {
      return { ok: false, message: 'Each entry needs an "@type". Without one a crawler cannot use it.' };
    }
  }

  return { ok: true, nodes: nodes.length };
}

export function StructuredData({
  kind,
  value,
  onChange,
  disabled,
}: {
  kind: StructuredDataKind;
  /** The stored `schemaJson`, whatever shape it is in. */
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  /**
   * The textarea holds text, not the parsed value.
   *
   * Round-tripping through `JSON.parse` on every keystroke would reformat what
   * somebody is halfway through typing and move their caret. The parsed value
   * goes up only when it parses.
   */
  const [text, setText] = React.useState(() =>
    value == null ? '' : JSON.stringify(value, null, 2),
  );
  const result = parse(text);

  const emitted = [...ALWAYS, ...ENTITY[kind]];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium">What this page tells a crawler</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Built from the fields on this record — there is nothing to fill in. One{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">@graph</code>, because a
          second script is a second, unlinked description of the same page.
        </p>

        <ul className="mt-3 divide-y rounded-lg border">
          {emitted.map(([type, note]) => (
            <li key={type} className="flex gap-3 p-3">
              <Check className="mt-0.5 size-4 shrink-0 text-[var(--status-published)]" />
              <div className="min-w-0">
                <code className="text-[13px] font-medium">{type}</code>
                <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-xs text-muted-foreground">
          {/* Worth saying once, because it is the thing people ask for. */}
          No rating or review markup, on either the page or here. The design has no star
          ratings, and describing ratings a visitor cannot see is the one thing Google
          calls out by name.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium">Anything else</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          JSON-LD added to the graph as it is — an object, or an array of them. For things
          the list above does not cover: an <code className="text-xs">Event</code> for a
          festival date, a <code className="text-xs">VideoObject</code> for a film. Do not
          repeat what is already there.
        </p>

        <Textarea
          value={text}
          disabled={disabled}
          spellCheck={false}
          rows={10}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const parsed = parse(next);
            if (!parsed.ok) return;
            onChange(next.trim() ? JSON.parse(next) : null);
          }}
          placeholder={'{\n  "@type": "Event",\n  "name": "Paro Tshechu",\n  "startDate": "2026-03-28"\n}'}
          className={cn(
            'mt-3 font-mono text-[13px]',
            !result.ok && 'border-destructive focus-visible:ring-destructive',
          )}
        />

        <p
          className={cn(
            'mt-2 flex items-center gap-1.5 text-xs',
            result.ok ? 'text-muted-foreground' : 'text-destructive',
          )}
        >
          {result.ok ? (
            result.nodes === 0 ? (
              'Empty, which is the right answer for almost every page.'
            ) : (
              <>
                <Check className="size-3.5" />
                {result.nodes === 1 ? '1 entry' : `${result.nodes} entries`} will be added to
                the graph.
              </>
            )
          ) : (
            <>
              <AlertTriangle className="size-3.5" />
              {result.message} Nothing is saved until this parses.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
