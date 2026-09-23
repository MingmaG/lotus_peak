'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { IconSelect } from '@/components/content/icon-select';
import { SeoPanel, type SeoValue } from '@/components/content/seo-panel';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { EditorShell, Field, PublishProblems, Section } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import { toSlug } from '@/lib/slug';
import { destinationPath } from '@/server/services/content-paths';

/**
 * A valley or a place, on a page of its own.
 *
 * The same editor for both, because they are the same kind of thing: a place
 * is a destination with a valley chosen above it. What changes is the
 * address — `/destinations/paro/taktsang` — and the hints, which say which of
 * the two you are writing.
 *
 * Three tabs rather than one long form: the page's fields, the body, and SEO.
 * The body gets a tab to itself because it is written for half an hour at a
 * time, and a rich-text editor at the foot of a form of twelve inputs is one
 * that is always scrolled halfway off the screen.
 */

export interface DestinationFormData {
  id: string | null;
  slug: string;
  name: string;
  parentId: string | null;
  /** A valley with places cannot be moved inside another. */
  hasPlaces: boolean;
  icon: string;
  blurb: string;
  standfirst: string;
  body: string;
  image: PickedMedia | null;
  ogImage: PickedMedia | null;
  altitudeMetres: number | null;
  latitude: number | null;
  longitude: number | null;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  seo: SeoValue;
}

function countWords(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function DestinationEditor({
  initial,
  valleys,
  siteUrl,
  canPublish,
  canDelete,
}: {
  initial: DestinationFormData;
  valleys: { id: string; name: string; slug: string }[];
  siteUrl: string;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();

  const [form, setForm] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [tab, setTab] = React.useState('page');
  const [problems, setProblems] = React.useState<Record<string, string>>({});

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof DestinationFormData>(key: K, value: DestinationFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const valley = valleys.find((v) => v.id === form.parentId) ?? null;
  const isPlace = form.parentId !== null;
  const path = destinationPath(form.slug || 'untitled', valley?.slug);
  const bodyWords = React.useMemo(() => countWords(form.body), [form.body]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        slug: form.slug || toSlug(form.name),
        parentId: form.parentId,
        icon: form.icon,
        blurb: form.blurb,
        standfirst: form.standfirst,
        body: form.body,
        imageId: form.image?.id ?? null,
        altitudeMetres: form.altitudeMetres,
        latitude: form.latitude,
        longitude: form.longitude,
        status: form.status,
        seo: { ...form.seo, ogImageId: form.ogImage?.id ?? null },
      };
      type Result = {
        destination: { id: string; slug: string };
        revalidated?: { ok: boolean; detail?: string };
      };
      return form.id
        ? apiPatch<Result>(`/api/destinations/${form.id}`, payload)
        : apiPost<Result>('/api/destinations', payload);
    },
    onSuccess: (result) => {
      setProblems({});
      const next = { ...form, id: result.destination.id, slug: result.destination.slug };
      setForm(next);
      setSaved(next);
      void client.invalidateQueries({ queryKey: ['destinations'] });

      if (result.revalidated && !result.revalidated.ok) {
        toast.warning('Saved, but the website was not told', {
          description: result.revalidated.detail,
        });
      } else {
        toast.success('Saved');
      }

      if (!initial.id) router.replace(`/destinations/${result.destination.id}/edit`);
      else router.refresh();
    },
    onError: (error: Error) => {
      if (error instanceof ApiClientError && error.fields) setProblems(error.fields);
      toast.error(error.message);
    },
  });

  const destroy = useMutation({
    mutationFn: () => apiDelete(`/api/destinations/${form.id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['destinations'] });
      toast.success('Removed');
      router.push(valley ? `/destinations/${valley.id}` : '/destinations');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const backHref = form.id
    ? `/destinations/${form.id}`
    : valley
      ? `/destinations/${valley.id}`
      : '/destinations';

  return (
    <EditorShell
      backHref={backHref}
      backLabel={form.id ? 'Back to the page' : valley ? valley.name : 'Where we go'}
      title={form.name || (isPlace ? 'A new place' : 'A new valley')}
      subtitle={form.id ? path : 'Not saved yet'}
      tabs={[
        { value: 'page', label: isPlace ? 'The place' : 'The valley' },
        { value: 'body', label: 'Body', badge: bodyWords },
        { value: 'seo', label: 'SEO' },
      ]}
      tab={tab}
      onTab={setTab}
      status={form.status}
      onStatus={(status) => set('status', status)}
      canPublish={canPublish}
      dirty={dirty}
      saving={save.isPending}
      onSave={() => save.mutate()}
      viewUrl={form.status === 'PUBLISHED' && form.id ? `${siteUrl}${path}` : null}
      previewUrl={form.id ? `/api/preview/destination/${form.id}` : null}
      notice={<PublishProblems problems={problems} onDismiss={() => setProblems({})} />}
    >
      {tab === 'page' && (
        <div className="space-y-5">
          <Section title={isPlace ? 'The place' : 'The valley'}>
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    /* The slug follows the name until the first save. After
                       that it is an address somebody may have linked to. */
                    slug: current.id ? current.slug : toSlug(event.target.value),
                  }))
                }
              />
            </Field>

            <Field
              label="Inside"
              hint={
                form.hasPlaces
                  ? 'This valley has places in it, so it stays a valley.'
                  : 'A valley is a page of its own under Where we go. A place — Taktsang, Punakha Dzong — sits inside a valley, and its page is under the valley’s.'
              }
              error={problems.parentId}
            >
              <Select
                value={form.parentId ?? 'none'}
                onValueChange={(value) => set('parentId', value === 'none' ? null : value)}
                disabled={form.hasPlaces}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nothing — this is a valley</SelectItem>
                  {valleys.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Address"
              hint={
                form.id
                  ? 'Changing it moves the page. A permanent redirect from the old address is written for you — and for every place inside a valley that is renamed.'
                  : 'Built from the name.'
              }
            >
              <div className="flex items-center gap-1 text-sm">
                <span className="shrink-0 text-muted-foreground">
                  {valley ? `/destinations/${valley.slug}/` : '/destinations/'}
                </span>
                <Input
                  value={form.slug}
                  onChange={(event) => set('slug', toSlug(event.target.value))}
                />
              </div>
            </Field>

            <Field
              label="One line, on the card"
              hint={isPlace ? '“The temple on the cliff above the Paro valley”.' : '“Taktsang, Kichu and Dungtse Lhakhang”.'}
              error={problems.blurb}
            >
              <Input value={form.blurb} onChange={(event) => set('blurb', event.target.value)} />
            </Field>

            <Field
              label="Standfirst"
              hint="The sentence under the title. It is also what a search result says unless the SEO tab overrides it, so it has to stand on its own."
              error={problems.standfirst}
            >
              <Textarea
                value={form.standfirst}
                rows={3}
                onChange={(event) => set('standfirst', event.target.value)}
              />
            </Field>

            <Field label="Silhouette" hint="The line drawing beside the name on the Where we go page.">
              <IconSelect value={form.icon} onChange={(icon) => set('icon', icon)} />
            </Field>
          </Section>

          <Section title="The photograph at the top">
            <MediaPicker value={form.image} onChange={(image) => set('image', image)} />
          </Section>

          <Section
            title="On a map"
            description="Published as coordinates in the page’s structured data, which is what puts a place on a map result."
          >
            <Field label="Altitude, metres">
              <Input
                type="number"
                value={form.altitudeMetres ?? ''}
                onChange={(event) =>
                  set('altitudeMetres', event.target.value ? Number(event.target.value) : null)
                }
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude">
                <Input
                  type="number"
                  step="any"
                  value={form.latitude ?? ''}
                  onChange={(event) =>
                    set('latitude', event.target.value ? Number(event.target.value) : null)
                  }
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="any"
                  value={form.longitude ?? ''}
                  onChange={(event) =>
                    set('longitude', event.target.value ? Number(event.target.value) : null)
                  }
                />
              </Field>
            </div>
          </Section>

          {form.id && canDelete && (
            <RemoveButton
              label={isPlace ? 'Remove this place' : 'Remove this valley'}
              onConfirm={() => destroy.mutate()}
              pending={destroy.isPending}
            />
          )}
        </div>
      )}

      {tab === 'body' && (
        <Section
          title="The page"
          description={
            isPlace
              ? 'What it is, how it came to be there, and what a visit is actually like. Headings, lists, photographs, films and tables — the same editor as the journal. Culture it explains belongs on the culture piece, and a dated story belongs in the journal; link to those rather than writing them again here.'
              : 'What is in the valley and what a journey does there. The places inside it have pages of their own — mention them, and write them up on their own pages.'
          }
        >
          <RichTextEditor
            value={form.body}
            onChange={(body) => set('body', body)}
            placeholder="Write the page…"
            minHeight="min-h-[60vh]"
          />
        </Section>
      )}

      {tab === 'seo' && (
        <SeoPanel
          kind="destination"
          value={form.seo}
          onChange={(patch) => set('seo', { ...form.seo, ...patch })}
          inherited={{ title: form.name, description: form.standfirst || form.blurb }}
          ogImage={form.ogImage}
          onOgImage={(media) => set('ogImage', media)}
          url={`${siteUrl}${path}`}
        />
      )}
    </EditorShell>
  );
}

/** A quiet remove, confirmed in the browser's own dialog. */
export function RemoveButton({
  label,
  onConfirm,
  pending,
}: {
  label: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`${label}? It comes off the website.`)) onConfirm();
        }}
        className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
