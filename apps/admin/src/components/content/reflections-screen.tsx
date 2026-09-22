'use client';

import { CatalogueScreen } from './catalogue';
import { StatusSelect } from './icon-select';
import { Field } from '@/components/shared/editor-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextEditor } from '@/components/editor/rich-text-editor';

interface Row {
  id: string;
  quote: string;
  name: string;
  detail: string | null;
  tripId: string | null;
  trip: { id: string; title: string } | null;
  featured: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  [key: string]: unknown;
}

interface Form {
  quote: string;
  name: string;
  detail: string;
  tripId: string;
  featured: boolean;
  status: string;
  isNew: boolean;
}

/**
 * What travellers have said.
 *
 * Called Reflections, not Testimonials or Reviews, because that is what the
 * design draws: a quote and a quiet attribution. There is no rating field, and
 * the note on the screen says so — the design forbids stars, and a field
 * nobody may render is a field somebody eventually will.
 */
export function ReflectionsScreen({
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
      endpoint="/api/reflections"
      queryKey="reflections"
      basePath="/reflections"
      title="Reflections"
      description="What travellers said, in their own words. No stars and no ratings — that is a rule of the design, not an omission."
      editId={editId}
      primary={(row) => `“${row.quote.slice(0, 70)}${row.quote.length > 70 ? '…' : ''}”`}
      secondary={(row) =>
        [row.name, row.detail, row.trip?.title, row.featured ? 'Featured' : null]
          .filter(Boolean)
          .join(' · ')
      }
      addLabel="Add a reflection"
      emptyTitle="Nothing yet"
      emptyDescription="A quote and who said it. Featured ones appear on the home page; the rest are on About and on the journey they name."
      editTitle={(form) => (form.isNew ? 'A new reflection' : form.name)}
      canWrite={canWrite}
      canDelete={canDelete}
      blank={() => ({
        quote: '',
        name: '',
        detail: '',
        tripId: 'none',
        featured: false,
        status: 'PUBLISHED',
        isNew: true,
      })}
      toForm={(row) => ({
        quote: row.quote,
        name: row.name,
        detail: row.detail ?? '',
        tripId: row.tripId ?? 'none',
        featured: row.featured,
        status: row.status,
        isNew: false,
      })}
      toBody={(form) => ({
        quote: form.quote,
        name: form.name,
        detail: form.detail || null,
        tripId: form.tripId === 'none' ? null : form.tripId,
        featured: form.featured,
        status: form.status,
      })}
      renderForm={(form, set) => (
        <>
          <Field label="What they said" hint="Their words. Do not tidy them up.">
            <RichTextEditor
              value={form.quote}
              onChange={(quote) => set({ quote })}
              compact
              minHeight="min-h-[120px]"
              placeholder="Their words."
            />
          </Field>

          <Field label="Who" hint="A first name is enough, and is what most of these use.">
            <Input value={form.name} onChange={(event) => set({ name: event.target.value })} />
          </Field>

          <Field label="Where and when" hint="“Bumthang, 2026”. Not a job title.">
            <Input value={form.detail} onChange={(event) => set({ detail: event.target.value })} />
          </Field>

          <Field
            label="Which journey"
            hint="Puts it on that journey's page. Leave it unset for a reflection about Lotus Peak rather than one trip."
          >
            <Select value={form.tripId} onValueChange={(tripId) => set({ tripId })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not about one journey</SelectItem>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={form.featured}
              onCheckedChange={(checked) => set({ featured: checked === true })}
            />
            <span>
              Feature it
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Featured reflections are the two on the home page.
              </span>
            </span>
          </label>

          <Field label="Status">
            <StatusSelect value={form.status} onChange={(status) => set({ status })} />
          </Field>

          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            There is no star rating here, and there will not be one. The design shows a
            quote and an attribution; a score would be a different kind of thing on a
            page that is not built for it.
          </p>
        </>
      )}
    />
  );
}
