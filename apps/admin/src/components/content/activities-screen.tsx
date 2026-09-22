'use client';

import { CatalogueScreen } from './catalogue';
import { IconSelect, StatusSelect } from './icon-select';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field } from '@/components/shared/editor-shell';
import { StringList } from '@/components/shared/sortable-list';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toSlug } from '@/lib/slug';

/** The enum, in the order the office would think of them. */
const ACTIVITY_KINDS: [string, string][] = [
  ['EXPERIENCE', 'Experience'],
  ['DAY_TOUR', 'Day tour'],
  ['RETREAT', 'Retreat'],
  ['COURSE', 'Course'],
  ['TREK', 'Trek'],
  ['FESTIVAL', 'Festival'],
  ['OTHER', 'Something else'],
];

interface Row {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  icon: string;
  kind: string;
  image: PickedMedia | null;
  examples: string[];
  trips: { id: string; title: string }[];
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  [key: string]: unknown;
}

interface Form {
  slug: string;
  name: string;
  blurb: string;
  icon: string;
  kind: string;
  image: PickedMedia | null;
  examples: string[];
  tripIds: string[];
  status: string;
  isNew: boolean;
}

export function ActivitiesScreen({
  canWrite,
  canDelete,
  editId,
  trips,
}: {
  canWrite: boolean;
  canDelete: boolean;
  /** Undefined draws the list; a string or null draws the editor. */
  editId?: string | null;
  trips: { id: string; title: string }[];
}) {
  return (
    <CatalogueScreen<Row, Form>
      endpoint="/api/activities"
      queryKey="activities"
      basePath="/activities"
      title="What you can do"
      description="The things a journey is made of. The order here is the order the page shows them in."
      editId={editId}
      primary={(row) => row.name}
      secondary={(row) =>
        `${ACTIVITY_KINDS.find(([value]) => value === row.kind)?.[1] ?? 'Experience'} · ${row.blurb}`
      }
      thumbnail={(row) => row.image?.url ?? null}
      addLabel="Add a grouping"
      emptyTitle="Nothing here yet"
      emptyDescription="Three ways of reading the same journeys — the culture, the practice, the walking. They are a lens, not a separate product."
      editTitle={(form) => (form.isNew ? 'A new grouping' : form.name)}
      canWrite={canWrite}
      canDelete={canDelete}
      blank={() => ({
        slug: '',
        name: '',
        blurb: '',
        icon: 'PAVILION',
        kind: 'EXPERIENCE',
        image: null,
        examples: [],
        tripIds: [],
        status: 'PUBLISHED',
        isNew: true,
      })}
      toForm={(row) => ({
        slug: row.slug,
        name: row.name,
        blurb: row.blurb,
        icon: row.icon,
        kind: row.kind,
        image: row.image,
        examples: row.examples,
        tripIds: row.trips.map((trip) => trip.id),
        status: row.status,
        isNew: false,
      })}
      toBody={(form) => ({
        slug: form.slug || toSlug(form.name),
        name: form.name,
        blurb: form.blurb,
        icon: form.icon,
        kind: form.kind,
        imageId: form.image?.id ?? null,
        examples: form.examples.filter((line) => line.trim()),
        tripIds: form.tripIds,
        status: form.status,
      })}
      renderForm={(form, set) => (
        <>
          <Field
            label="Kind"
            hint="What sort of thing this is. The site sells journeys today; day tours, retreats and courses are what this is here for, and the page groups by it."
          >
            <select
              value={form.kind}
              onChange={(event) => set({ kind: event.target.value })}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              {ACTIVITY_KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) =>
                set({
                  name: event.target.value,
                  ...(form.isNew ? { slug: toSlug(event.target.value) } : {}),
                })
              }
            />
          </Field>
          <Field label="URL fragment">
            <Input value={form.slug} onChange={(event) => set({ slug: toSlug(event.target.value) })} />
          </Field>
          <Field label="One line">
            <Input value={form.blurb} onChange={(event) => set({ blurb: event.target.value })} />
          </Field>
          <Field
            label="What the day consists of"
            hint="Three to five lines. Specific things, not adjectives."
          >
            <StringList
              items={form.examples}
              onChange={(examples) => set({ examples })}
              placeholder="Cham dances in a dzong courtyard at a tshechu"
              addLabel="Add a line"
              empty="Nothing listed."
            />
          </Field>
          <Field label="Silhouette">
            <IconSelect value={form.icon} onChange={(icon) => set({ icon })} />
          </Field>
          <MediaPicker value={form.image} onChange={(image) => set({ image })} />
          <Field label="Which journeys have this in them">
            <div className="space-y-2">
              {trips.map((trip) => (
                <label key={trip.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.tripIds.includes(trip.id)}
                    onCheckedChange={(checked) =>
                      set({
                        tripIds:
                          checked === true
                            ? [...form.tripIds, trip.id]
                            : form.tripIds.filter((id) => id !== trip.id),
                      })
                    }
                  />
                  {trip.title}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Status">
            <StatusSelect value={form.status} onChange={(status) => set({ status })} />
          </Field>
        </>
      )}
    />
  );
}
