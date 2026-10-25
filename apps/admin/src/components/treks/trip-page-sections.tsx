'use client';

import { Field, Section } from '@/components/shared/editor-shell';
import { MediaPicker } from '@/components/media/media-picker';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TripTrailForm } from './trip-editor';

/**
 * What the journey's page draws around the itinerary, and what goes in it.
 *
 * Its own file because the Links tab was already the longest in the editor,
 * and these switches and the pickers under them are one decision: "what does
 * this page offer somebody reading down it". The band above the itinerary is
 * here too, but it is drawn on the Journey tab — see `TripTrailBand`.
 */

export interface TripSectionsForm {
  trail: boolean;
  gallery: boolean;
  destinations: boolean;
  culture: boolean;
  journal: boolean;
  related: boolean;
}

/* No "On the trail" here: its switch sits with its photograph and words on
   the Journey tab, so the office finds all of the band in one place. */
const BANDS: { key: Exclude<keyof TripSectionsForm, 'trail'>; label: string; hint: string }[] = [
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
 * The band above the itinerary: a photograph, and the words over it.
 *
 * On the Journey tab, with the hero and the overview, and carrying its own
 * switch. It sat on the Links tab beside the other bands' switches, and the
 * office could not find it there: a photograph and three lines of copy are
 * what a journey says about itself, not a link to somewhere else. The switch
 * came with it, so whether the band is drawn is decided beside what it says.
 *
 * The photograph is what decides whether the band exists: without one the
 * site draws nothing, because the band is a photograph under two scrims and
 * without it there is nothing to put the words on. The field says so rather
 * than making somebody save and go and look.
 */
export function TripTrailBand({
  value,
  onChange,
  shown,
  onShownChange,
}: {
  value: TripTrailForm;
  onChange: (next: TripTrailForm) => void;
  /** Off: the photograph and the words are kept, and the field says so. */
  shown: boolean;
  onShownChange: (shown: boolean) => void;
}) {
  const set = <K extends keyof TripTrailForm>(key: K, next: TripTrailForm[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <Section
      title="On the trail"
      description={
        shown
          ? 'The photograph across the page between the enquiry form and the itinerary, and the words over it. Without a photograph the band is not drawn.'
          : 'Switched off, so none of this shows. It is kept.'
      }
    >
      <label
        htmlFor="band-trail"
        className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3"
      >
        <span className="text-sm">
          Show this band
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Above the itinerary, on this journey&rsquo;s page.
          </span>
        </span>
        <Switch id="band-trail" checked={shown} onCheckedChange={onShownChange} />
      </label>

      <div className={cn('space-y-4', !shown && 'opacity-60')}>
        <MediaPicker
          value={value.image}
          onChange={(media) => set('image', media)}
          label="The photograph"
          description="Wide, and with room in the middle for the words. It is read as part of the page, not as decoration, so its description is used."
        />

        <Field label="Eyebrow" hint="The small line above the heading. “On the trail”.">
          <Input
            value={value.eyebrow}
            maxLength={60}
            onChange={(event) => set('eyebrow', event.target.value)}
            placeholder="On the trail"
          />
        </Field>

        <Field label="Heading" hint="Set large over the photograph, so it wraps after a few words.">
          <Input
            value={value.title}
            maxLength={120}
            onChange={(event) => set('title', event.target.value)}
            placeholder="Walked at a pace that leaves room to notice"
          />
        </Field>

        <Field
          label="Words"
          hint="Two or three short sentences. What the days are actually like on this journey."
        >
          <Textarea
            value={value.body}
            maxLength={400}
            rows={3}
            onChange={(event) => set('body', event.target.value)}
            placeholder="Two nights in most valleys. Drives of no more than five hours…"
          />
        </Field>

        {value.image === null && (value.eyebrow || value.title || value.body) && (
          <p className="text-xs text-muted-foreground">
            Choose a photograph, or these words are not drawn.
          </p>
        )}
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
