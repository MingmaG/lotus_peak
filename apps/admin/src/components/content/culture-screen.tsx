'use client';

import { CatalogueScreen } from './catalogue';
import { IconSelect, StatusSelect } from './icon-select';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { toSlug } from '@/lib/slug';

interface Row {
  id: string;
  slug: string;
  title: string;
  body: string;
  icon: string;
  image: PickedMedia | null;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  [key: string]: unknown;
}

interface Form {
  slug: string;
  title: string;
  body: string;
  icon: string;
  image: PickedMedia | null;
  status: string;
  isNew: boolean;
}

export function CultureScreen({
  canWrite,
  canDelete,
  editId,
}: {
  canWrite: boolean;
  canDelete: boolean;
  /** Undefined draws the list; a string or null draws the editor. */
  editId?: string | null;
}) {
  return (
    <CatalogueScreen<Row, Form>
      endpoint="/api/culture"
      queryKey="culture"
      basePath="/culture"
      title="Culture"
      description="The short pieces on /culture. The order here is the order the page shows them in."
      editId={editId}
      primary={(row) => row.title}
      secondary={(row) => row.body.slice(0, 110)}
      thumbnail={(row) => row.image?.url ?? null}
      addLabel="Add an article"
      emptyTitle="Nothing on culture yet"
      emptyDescription="Tshechu, dzongs, textiles, the thirteen arts — the short pieces on /culture that explain what a traveller is about to see."
      editTitle={(form) => (form.isNew ? 'A new article' : form.title)}
      canWrite={canWrite}
      canDelete={canDelete}
      blank={() => ({
        slug: '',
        title: '',
        body: '',
        icon: 'CHORTEN',
        image: null,
        status: 'PUBLISHED',
        isNew: true,
      })}
      toForm={(row) => ({
        slug: row.slug,
        title: row.title,
        body: row.body,
        icon: row.icon,
        image: row.image,
        status: row.status,
        isNew: false,
      })}
      toBody={(form) => ({
        slug: form.slug || toSlug(form.title),
        title: form.title,
        body: form.body,
        icon: form.icon,
        imageId: form.image?.id ?? null,
        status: form.status,
      })}
      renderForm={(form, set) => (
        <>
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(event) =>
                set({
                  title: event.target.value,
                  ...(form.isNew ? { slug: toSlug(event.target.value) } : {}),
                })
              }
            />
          </Field>
          <Field label="URL fragment">
            <Input value={form.slug} onChange={(event) => set({ slug: toSlug(event.target.value) })} />
          </Field>
          <Field
            label="The piece"
            hint="A paragraph or two. Plain and specific — the voice the rest of the site uses."
          >
            <RichTextEditor
              value={form.body}
              onChange={(body) => set({ body })}
              placeholder="A paragraph or two."
            />
          </Field>
          <Field label="Silhouette">
            <IconSelect value={form.icon} onChange={(icon) => set({ icon })} />
          </Field>
          <MediaPicker value={form.image} onChange={(image) => set({ image })} />
          <Field label="Status">
            <StatusSelect value={form.status} onChange={(status) => set({ status })} />
          </Field>
        </>
      )}
    />
  );
}
