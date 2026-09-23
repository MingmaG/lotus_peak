'use client';

import { Section } from '@/components/shared/editor-shell';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * What the journey's page draws below the itinerary, and what goes in it.
 *
 * Its own file because the Links tab was already the longest in the editor,
 * and these five switches and two pickers are one decision: "what does this
 * page offer somebody who has read to the bottom of it".
 */

export interface TripSectionsForm {
  gallery: boolean;
  destinations: boolean;
  culture: boolean;
  journal: boolean;
  related: boolean;
}

const BANDS: { key: keyof TripSectionsForm; label: string; hint: string }[] = [
  {
    key: 'gallery',
    label: 'Photographs',
    hint: 'The gallery from the Photographs tab, with its viewer.',
  },
  {
    key: 'destinations',
    label: 'Where you will go',
    hint: 'The places on the route, as cards linking to their pages.',
  },
  {
    key: 'culture',
    label: 'Culture on the way',
    hint: 'The culture pieces chosen below, or else those linked to the route.',
  },
  {
    key: 'journal',
    label: 'From the journal',
    hint: 'The entries chosen below, or else the newest about the route.',
  },
  {
    key: 'related',
    label: 'Other journeys',
    hint: 'The journeys chosen below, or else the next few in the catalogue.',
  },
];

export function TripPageSections({
  value,
  onChange,
}: {
  value: TripSectionsForm;
  onChange: (next: TripSectionsForm) => void;
}) {
  return (
    <Section
      title="On the journey's page"
      description="Which bands the page shows. A band with nothing in it is not drawn, whatever it is set to here."
    >
      <div className="divide-y rounded-lg border">
        {BANDS.map((band) => (
          <label
            key={band.key}
            htmlFor={`band-${band.key}`}
            className="flex cursor-pointer items-start justify-between gap-4 p-3"
          >
            <span className="text-sm">
              {band.label}
              <span className="mt-0.5 block text-xs text-muted-foreground">{band.hint}</span>
            </span>
            <Switch
              id={`band-${band.key}`}
              checked={value[band.key]}
              onCheckedChange={(checked) => onChange({ ...value, [band.key]: checked })}
            />
          </label>
        ))}
      </div>
    </Section>
  );
}

/**
 * A list of rows to choose from, in the order they are chosen.
 *
 * Click order is the page's order, which is what the route picker above it
 * already does — so the two read the same way.
 */
export function OrderedPicker({
  title,
  description,
  options,
  value,
  onChange,
  disabled,
  empty,
}: {
  title: string;
  description: string;
  options: { id: string; label: string; detail?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  /** The band is switched off: the choice is kept, but says it will not show. */
  disabled?: boolean;
  empty: string;
}) {
  return (
    <Section
      title={title}
      description={
        disabled ? `${description} This band is switched off above, so nothing here shows.` : description
      }
    >
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className={cn('space-y-2', disabled && 'opacity-60')}>
          {options.map((option) => {
            const at = value.indexOf(option.id);
            return (
              <label
                key={option.id}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <Checkbox
                  checked={at !== -1}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...value, option.id]
                        : value.filter((id) => id !== option.id),
                    )
                  }
                />
                <span className="flex-1">
                  {option.label}
                  {option.detail && (
                    <span className="ml-2 text-xs text-muted-foreground">{option.detail}</span>
                  )}
                </span>
                {at !== -1 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {at + 1}
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
      )}
    </Section>
  );
}
