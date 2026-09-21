'use client';

import { CatalogueScreen } from './catalogue-screen';
import { IconSelect, StatusSelect } from './icon-select';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toSlug } from '@/lib/slug';

interface Row {
  id: string;
  slug: string;
  name: string;
  icon: string;
  blurb: string;
  detail: string;
  image: PickedMedia | null;
  altitudeMetres: number | null;
  latitude: number | null;
  longitude: number | null;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  trips: { id: string; title: string; offered: boolean }[];
  [key: string]: unknown;
}

interface Form {
  slug: string;
  name: string;
  icon: string;
  blurb: string;
  detail: string;
  image: PickedMedia | null;
  altitudeMetres: number | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  isNew: boolean;
}

export function DestinationsScreen({
  canWrite,
  canDelete,
}: {
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <CatalogueScreen<Row, Form>
      endpoint="/api/destinations"
      queryKey="destinations"
      primary={(row) => row.name}
      secondary={(row) =>
        `${row.blurb}${row.trips.length ? ` · ${row.trips.filter((t) => t.offered).length} journeys offered` : ''}`
      }
      thumbnail={(row) => row.image?.url ?? null}
      addLabel="Add a place"
      emptyTitle="No places yet"
      emptyDescription="The valleys the journeys pass through. Each one gets a panel on /destinations and a link from every journey that goes there."
      editTitle={(form) => (form.isNew ? 'A new place' : form.name)}
      editDescription="The order here is the order the page shows them in — drag the list to change it."
      canWrite={canWrite}
      canDelete={canDelete}
      blank={() => ({
        slug: '',
        name: '',
        icon: 'DZONG',
        blurb: '',
        detail: '',
        image: null,
        altitudeMetres: null,
        latitude: null,
        longitude: null,
        status: 'PUBLISHED',
        isNew: true,
      })}
      toForm={(row) => ({
        slug: row.slug,
        name: row.name,
        icon: row.icon,
        blurb: row.blurb,
        detail: row.detail,
        image: row.image,
        altitudeMetres: row.altitudeMetres,
        latitude: row.latitude,
        longitude: row.longitude,
        status: row.status,
        isNew: false,
      })}
      toBody={(form) => ({
        slug: form.slug || toSlug(form.name),
        name: form.name,
        icon: form.icon,
        blurb: form.blurb,
        detail: form.detail,
        imageId: form.image?.id ?? null,
        altitudeMetres: form.altitudeMetres,
        latitude: form.latitude,
        longitude: form.longitude,
        status: form.status,
      })}
      renderForm={(form, set) => (
        <>
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) =>
                set({
                  name: event.target.value,
                  /* The slug follows the name until the place is saved. After
                     that it is a fragment somebody may have linked to. */
                  ...(form.isNew ? { slug: toSlug(event.target.value) } : {}),
                })
              }
            />
          </Field>

          <Field
            label="URL fragment"
            hint={
              form.isNew
                ? 'Built from the name.'
                : 'Changing it moves the anchor on /destinations. A redirect is written for you.'
            }
          >
            <Input
              value={form.slug}
              onChange={(event) => set({ slug: toSlug(event.target.value) })}
            />
          </Field>

          <Field label="Silhouette" hint="The icon beside the name.">
            <IconSelect value={form.icon} onChange={(icon) => set({ icon })} />
          </Field>

          <Field label="One line" hint="On the card. “Taktsang, Kichu and Dungtse Lhakhang”.">
            <Input value={form.blurb} onChange={(event) => set({ blurb: event.target.value })} />
          </Field>

          <Field label="The paragraph" hint="What is actually there, and what a journey does in it.">
            <Textarea
              value={form.detail}
              rows={6}
              onChange={(event) => set({ detail: event.target.value })}
            />
          </Field>

          <MediaPicker value={form.image} onChange={(image) => set({ image })} />

          <Field label="Altitude, metres">
            <Input
              type="number"
              value={form.altitudeMetres ?? ''}
              onChange={(event) =>
                set({ altitudeMetres: event.target.value ? Number(event.target.value) : null })
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Latitude"
              hint="Published as coordinates in the structured data, which is what puts a place on a map result."
            >
              <Input
                type="number"
                step="any"
                value={form.latitude ?? ''}
                onChange={(event) =>
                  set({ latitude: event.target.value ? Number(event.target.value) : null })
                }
              />
            </Field>
            <Field label="Longitude">
              <Input
                type="number"
                step="any"
                value={form.longitude ?? ''}
                onChange={(event) =>
                  set({ longitude: event.target.value ? Number(event.target.value) : null })
                }
              />
            </Field>
          </div>

          <Field label="Status">
            <StatusSelect value={form.status} onChange={(status) => set({ status })} />
          </Field>
        </>
      )}
    />
  );
}
