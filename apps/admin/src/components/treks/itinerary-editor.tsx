'use client';

import { ImagePlus, Moon, Sun, X } from 'lucide-react';
import * as React from 'react';

import type { ItineraryDayForm } from './trip-editor';
import { MediaMultiPicker, type PickedMedia } from '@/components/media/media-picker';
import { Section } from '@/components/shared/editor-shell';
import { SortableList } from '@/components/shared/sortable-list';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The day-by-day.
 *
 * ## The numbers are live, and they are not stored
 *
 * Each row shows the number the website will print, recomputed as the office
 * drags days around. Nothing writes it down: an itinerary with an arrival day
 * inserted at the front is one where every stored number after it is wrong,
 * and no office should renumber fourteen rows to add one.
 *
 * **A rest day takes a number; it just does not print one.** The Jomolhari
 * trek is why: a rest day at Jangothang sits at position six and the walk to
 * Lingshi after it is Day 7. Counting only the days that print a number would
 * call it Day 6, and a fourteen-day journey would end on Day 12. These are
 * dates on a traveller's calendar, not entries in a list.
 *
 * The same rule is in `public-site.ts`, which is what the site actually
 * renders. Two implementations of one rule is a preview that can lie, and the
 * comment is in both places so a change to either finds the other.
 *
 * ## A day holds photographs two ways, and both are right
 *
 * The body is the full editor, so a photograph can sit in the middle of what
 * the day says — "the climb starts here", and then the climb. The row of
 * photographs under it belongs to the *day* rather than to a sentence, and the
 * website draws it as a strip beneath the prose. The office picks whichever
 * one the picture is about; a day with eight photographs and four sentences
 * wants the strip, and a day with one photograph of the pass wants it in the
 * paragraph about the pass.
 */
export function ItineraryEditor({
  days,
  onChange,
}: {
  days: ItineraryDayForm[];
  onChange: (days: ItineraryDayForm[]) => void;
}) {
  const patch = (index: number, value: Partial<ItineraryDayForm>) => {
    const next = [...days];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...value };
    onChange(next);
  };

  const nights = days.length > 0 ? days.length - 1 : 0;

  return (
    <Section
      title="Itinerary"
      description={
        days.length > 0
          ? `${days.length} ${days.length === 1 ? 'day' : 'days'} — ${nights} ${nights === 1 ? 'night' : 'nights'}. Drag to reorder; the numbers follow.`
          : 'One row per day, in order. A rest day keeps its place in the count and shows “Rest day” instead of a number.'
      }
    >
      <SortableList
        items={days}
        itemKey={(day) => day.key}
        onChange={onChange}
        onRemove={(index) => onChange(days.filter((_, i) => i !== index))}
        onAdd={() =>
          onChange([
            ...days,
            {
              key: crypto.randomUUID(),
              isRest: false,
              title: '',
              meta: '',
              body: '',
              images: [],
            },
          ])
        }
        addLabel="Add a day"
        empty="No days yet. This is the part of a journey page every enquiry asks about."
        describeItem={(day, index) => day.title || `day ${index + 1}`}
        renderItem={(day, index) => (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                  day.isRest
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-primary/10 text-primary',
                )}
              >
                {day.isRest ? 'Rest day' : `Day ${index + 1}`}
              </span>

              <Input
                value={day.title}
                placeholder="Jangothang to Lingshi"
                onChange={(event) => patch(index, { title: event.target.value })}
                className="h-8 min-w-40 flex-1"
                aria-label={`Title for day ${index + 1}`}
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patch(index, { isRest: !day.isRest })}
                className="shrink-0 text-xs text-muted-foreground"
                title={
                  day.isRest
                    ? 'Make this a numbered day'
                    : 'Make this a rest day — it keeps its place in the count'
                }
              >
                {day.isRest ? (
                  <Sun className="mr-1 size-3.5" />
                ) : (
                  <Moon className="mr-1 size-3.5" />
                )}
                {day.isRest ? 'Walking day' : 'Rest day'}
              </Button>
            </div>

            <Input
              value={day.meta}
              placeholder="Paro · 2,280 m · 4 h drive"
              onChange={(event) => patch(index, { meta: event.target.value })}
              className="h-8 text-xs"
              aria-label={`Details line for day ${index + 1}`}
            />

            {/* Not `compact`: a day has to be able to hold the photograph it
                is about, and a table of distances and altitudes. */}
            <RichTextEditor
              value={day.body}
              onChange={(body) => patch(index, { body })}
              minHeight="min-h-[120px]"
              placeholder="What the day is."
              aria-labelledby={`day-${index}-label`}
            />

            <DayImages
              images={day.images}
              onChange={(images) => patch(index, { images })}
              dayLabel={day.isRest ? 'the rest day' : `day ${index + 1}`}
            />
          </div>
        )}
      />
    </Section>
  );
}

/**
 * The day's own photographs.
 *
 * Added in the order they are picked and removed one at a time. No drag here,
 * deliberately: the row sits inside the list of days, which is itself
 * draggable, and nesting one drag surface in another made picking a day up by
 * its photograph the easiest thing to do by accident. Reordering four
 * photographs is remove-and-re-add; reordering fourteen days is not.
 *
 * A photograph already on the day is skipped rather than duplicated — the
 * table has a `@@unique([dayId, mediaId])`, so the save would silently drop
 * the second copy anyway and the form would be the only thing that thought it
 * was there.
 */
function DayImages({
  images,
  onChange,
  dayLabel,
}: {
  images: PickedMedia[];
  onChange: (images: PickedMedia[]) => void;
  dayLabel: string;
}) {
  const add = (picked: PickedMedia[]) => {
    const have = new Set(images.map((image) => image.id));
    onChange([...images, ...picked.filter((image) => !have.has(image.id))]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {images.map((image, index) => (
        <span key={image.id} className="group relative">
          <img
            src={image.url}
            alt=""
            className="size-14 rounded object-cover"
          />
          <button
            type="button"
            aria-label={`Remove photograph ${index + 1} from ${dayLabel}`}
            onClick={() => onChange(images.filter((row) => row.id !== image.id))}
            className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      <MediaMultiPicker
        onPick={add}
        trigger={
          <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground">
            <ImagePlus className="mr-1.5 size-3.5" />
            {images.length ? 'More photographs' : 'Photographs for the day'}
          </Button>
        }
      />
    </div>
  );
}
