'use client';

import { ImagePlus } from 'lucide-react';
import * as React from 'react';

import { MediaMultiPicker } from '@/components/media/media-picker';
import { Section } from '@/components/shared/editor-shell';
import { SortableList } from '@/components/shared/sortable-list';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface GalleryItemForm {
  mediaId: string;
  url: string;
  alt: string;
  ratio: string | null;
  width: string | null;
}

/**
 * The photograph strip on a journey page.
 *
 * Two fields per picture beyond the picture itself, and both are design
 * decisions rather than data:
 *
 * - **Shape** crops the cell. The strip reads as a contact sheet because the
 *   ratios are mixed; every cell at 3/2 is a filmstrip, which is a different
 *   and duller thing.
 * - **Width** is how much of the viewport the cell takes as the strip scrolls.
 *   A tall portrait wants less width than a wide landscape, or the strip
 *   leaves a hole beside it.
 *
 * Both default to the photograph's own, which is right most of the time.
 */
const RATIOS = ['3/2', '4/3', '16/9', '1/1', '4/5', '2/3', '3/4'];
const WIDTHS = ['26vw', '34vw', '44vw', '60vw'];

export function TripGalleryEditor({
  items,
  onChange,
}: {
  items: GalleryItemForm[];
  onChange: (items: GalleryItemForm[]) => void;
}) {
  const patch = (index: number, value: Partial<GalleryItemForm>) => {
    const next = [...items];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...value };
    onChange(next);
  };

  return (
    <Section
      title="Photographs"
      description="The strip that scrolls sideways under the itinerary. Mixed shapes are what make it read as a contact sheet rather than a filmstrip."
    >
      <SortableList
        items={items}
        itemKey={(item) => item.mediaId}
        onChange={onChange}
        onRemove={(index) => onChange(items.filter((_, i) => i !== index))}
        empty="No photographs yet."
        describeItem={(item, index) => item.alt || `photograph ${index + 1}`}
        renderItem={(item, index) => (
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={item.url}
              alt=""
              className="size-14 shrink-0 rounded object-cover"
            />

            <p className="min-w-40 flex-1 truncate text-xs text-muted-foreground">
              {item.alt || (
                <span className="text-destructive">No description</span>
              )}
            </p>

            <Select
              value={item.ratio ?? 'auto'}
              onValueChange={(value) =>
                patch(index, { ratio: value === 'auto' ? null : value })
              }
            >
              <SelectTrigger className="h-8 w-28 text-xs" aria-label="Shape">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Its own shape</SelectItem>
                {RATIOS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={item.width ?? 'auto'}
              onValueChange={(value) =>
                patch(index, { width: value === 'auto' ? null : value })
              }
            >
              <SelectTrigger className="h-8 w-28 text-xs" aria-label="Width in the strip">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Default width</SelectItem>
                {WIDTHS.map((width) => (
                  <SelectItem key={width} value={width}>
                    {width}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />

      <MediaMultiPicker
        onPick={(media) =>
          onChange([
            ...items,
            /* Already in the strip? Skip it — `(tripId, mediaId)` is unique,
               and a second copy would be rejected by the save with a message
               about a constraint. */
            ...media
              .filter((one) => !items.some((item) => item.mediaId === one.id))
              .map((one) => ({
                mediaId: one.id,
                url: one.url,
                alt: one.alt,
                ratio: null,
                width: null,
              })),
          ])
        }
        trigger={
          <Button type="button" variant="outline" size="sm">
            <ImagePlus className="mr-1.5 size-3.5" />
            Add photographs
          </Button>
        }
      />
    </Section>
  );
}
