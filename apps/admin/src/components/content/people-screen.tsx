'use client';

import { CatalogueScreen } from './catalogue';
import { StatusSelect } from './icon-select';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/editor/rich-text-editor';

interface Row {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: PickedMedia | null;
  languages: string[];
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  [key: string]: unknown;
}

interface Form {
  name: string;
  role: string;
  bio: string;
  photo: PickedMedia | null;
  languages: string;
  status: string;
  isNew: boolean;
}

export function PeopleScreen({
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
      endpoint="/api/people"
      queryKey="people"
      basePath="/people"
      title="People"
      description="Guides, teachers and the office. The order here is the order the page shows them in."
      editId={editId}
      primary={(row) => row.name}
      secondary={(row) => [row.role, row.languages.join(', ')].filter(Boolean).join(' · ')}
      thumbnail={(row) => row.photo?.url ?? null}
      addLabel="Add somebody"
      emptyTitle="Nobody here yet"
      emptyDescription="The guides, and whoever the About page should introduce."
      editTitle={(form) => (form.isNew ? 'Somebody new' : form.name)}
      canWrite={canWrite}
      canDelete={canDelete}
      blank={() => ({
        name: '',
        role: '',
        bio: '',
        photo: null,
        languages: '',
        status: 'PUBLISHED',
        isNew: true,
      })}
      toForm={(row) => ({
        name: row.name,
        role: row.role,
        bio: row.bio,
        photo: row.photo,
        languages: row.languages.join(', '),
        status: row.status,
        isNew: false,
      })}
      toBody={(form) => ({
        name: form.name,
        role: form.role,
        bio: form.bio,
        photoId: form.photo?.id ?? null,
        languages: form.languages
          .split(',')
          .map((word) => word.trim())
          .filter(Boolean),
        status: form.status,
      })}
      renderForm={(form, set) => (
        <>
          <Field label="Name">
            <Input value={form.name} onChange={(event) => set({ name: event.target.value })} />
          </Field>
          <Field label="What they do" hint="“Guide”, “Founder”, “Lam”.">
            <Input value={form.role} onChange={(event) => set({ role: event.target.value })} />
          </Field>
          <Field label="A few sentences">
            <RichTextEditor
              value={form.bio}
              onChange={(bio) => set({ bio })}
              compact
              minHeight="min-h-[140px]"
              placeholder="Who they are, and what they do on a journey."
            />
          </Field>
          <MediaPicker
            label="Photograph"
            description="A portrait. The design puts these on white rather than on a tint — a wash behind a face reads badly."
            value={form.photo}
            onChange={(photo) => set({ photo })}
          />
          <Field label="Languages" hint="Comma-separated.">
            <Input
              value={form.languages}
              placeholder="Dzongkha, English, Hindi"
              onChange={(event) => set({ languages: event.target.value })}
            />
          </Field>
          <Field label="Status">
            <StatusSelect value={form.status} onChange={(status) => set({ status })} />
          </Field>
        </>
      )}
    />
  );
}
