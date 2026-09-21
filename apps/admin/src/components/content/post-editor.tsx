'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { BlockEditor, type EditorBlock } from '@/components/editor/block-editor';
import { SeoPanel, type SeoValue } from '@/components/content/seo-panel';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import {
  EditorShell,
  Field,
  PublishProblems,
  Section,
} from '@/components/shared/editor-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiPatch, apiPost } from '@/lib/api-client';
import { toSlug } from '@/lib/slug';

export interface PostFormData {
  id: string | null;
  slug: string;
  title: string;
  standfirst: string;
  region: string;
  body: EditorBlock[];
  hero: PickedMedia | null;
  ogImage: PickedMedia | null;
  authorId: string | null;
  tags: string;
  relatedTripIds: string[];
  featured: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  seo: SeoValue;
}

const TABS = [
  { value: 'entry', label: 'Entry' },
  { value: 'body', label: 'Body' },
  { value: 'links', label: 'Links' },
  { value: 'seo', label: 'SEO' },
];

export function PostEditor({
  initial,
  authors,
  trips,
  siteUrl,
  canPublish,
}: {
  initial: PostFormData;
  authors: { id: string; name: string }[];
  trips: { id: string; title: string }[];
  siteUrl: string;
  canPublish: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();

  const [form, setForm] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [tab, setTab] = React.useState('entry');
  const [problems, setProblems] = React.useState<Record<string, string>>({});

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof PostFormData>(key: K, value: PostFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        slug: form.slug,
        standfirst: form.standfirst,
        region: form.region,
        /* Blocks lose their editing key and gain their media id on the way
           out — the column stores a reference, not a copy of the photograph. */
        body: form.body
          .map((block) => {
            const { key: _key, ...rest } = block;
            if (rest.kind === 'image') {
              return rest.media ? { kind: 'image', mediaId: rest.media.id, ratio: rest.ratio } : null;
            }
            return rest;
          })
          .filter(Boolean),
        heroId: form.hero?.id ?? null,
        authorId: form.authorId,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        relatedTripIds: form.relatedTripIds,
        featured: form.featured,
        status: form.status,
        publishedAt: form.publishedAt,
        seo: { ...form.seo, ogImageId: form.ogImage?.id ?? null },
      };

      type Result = {
        post: { id: string; slug: string };
        revalidated?: { ok: boolean; detail?: string };
      };

      return form.id
        ? apiPatch<Result>(`/api/posts/${form.id}`, payload)
        : apiPost<Result>('/api/posts', payload);
    },
    onSuccess: (result) => {
      setProblems({});
      const next = { ...form, id: result.post.id, slug: result.post.slug };
      setForm(next);
      setSaved(next);
      void client.invalidateQueries({ queryKey: ['posts'] });

      if (result.revalidated && !result.revalidated.ok) {
        toast.warning('Saved, but the website was not told', {
          description: result.revalidated.detail,
        });
      } else {
        toast.success('Saved');
      }

      if (!initial.id) router.replace(`/journal/${result.post.id}`);
    },
    onError: (error: Error) => {
      if (error instanceof ApiClientError && error.fields) {
        setProblems(error.fields);
        setForm((current) => ({ ...current, status: saved.status }));
      }
      toast.error(error.message);
    },
  });

  const publicUrl = `${siteUrl}/journal/${form.slug || 'untitled'}`;

  return (
    <EditorShell
      backHref="/journal"
      backLabel="Journal"
      title={form.title}
      subtitle={form.slug ? `/journal/${form.slug}` : 'Not saved yet'}
      tabs={TABS.map((item) =>
        item.value === 'body' ? { ...item, badge: form.body.length } : item,
      )}
      tab={tab}
      onTab={setTab}
      status={form.status}
      onStatus={(status) => set('status', status)}
      canPublish={canPublish}
      dirty={dirty}
      saving={save.isPending}
      onSave={() => save.mutate()}
      viewUrl={form.status === 'PUBLISHED' && form.id ? publicUrl : null}
      previewUrl={form.id ? `/api/preview/post/${form.id}` : null}
      notice={<PublishProblems problems={problems} onDismiss={() => setProblems({})} />}
    >
      {tab === 'entry' && (
        <div className="space-y-5">
          <Section title="The entry">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                    slug: current.id ? current.slug : toSlug(event.target.value),
                  }))
                }
              />
            </Field>

            <Field
              label="URL"
              hint={
                form.id
                  ? 'Changing this moves the entry. A permanent redirect is written for you.'
                  : 'Built from the title.'
              }
            >
              <div className="flex items-center gap-1 text-sm">
                <span className="shrink-0 text-muted-foreground">/journal/</span>
                <Input value={form.slug} onChange={(event) => set('slug', toSlug(event.target.value))} />
              </div>
            </Field>

            <Field
              label="Standfirst"
              hint="The sentence under the title. It is also the default meta description, and the line marked as the one worth reading aloud — so it has to stand on its own."
            >
              <Textarea
                value={form.standfirst}
                rows={3}
                onChange={(event) => set('standfirst', event.target.value)}
              />
            </Field>

            <Field label="Where it is about" hint="“Bumthang”, “Paro”.">
              <Input value={form.region} onChange={(event) => set('region', event.target.value)} />
            </Field>

            <Field label="Who wrote it">
              <Select
                value={form.authorId ?? 'none'}
                onValueChange={(value) => set('authorId', value === 'none' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Lotus Peak</SelectItem>
                  {authors.map((author) => (
                    <SelectItem key={author.id} value={author.id}>
                      {author.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Date"
              hint="What the entry is dated, and how the journal sorts. Set once on the first publish; changing it moves the entry in the list."
            >
              <Input
                type="date"
                value={form.publishedAt ? form.publishedAt.slice(0, 10) : ''}
                onChange={(event) =>
                  set(
                    'publishedAt',
                    event.target.value ? new Date(event.target.value).toISOString() : null,
                  )
                }
              />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.featured}
                onCheckedChange={(checked) => set('featured', checked === true)}
              />
              Feature it
            </label>
          </Section>

          <Section title="The photograph at the top">
            <MediaPicker value={form.hero} onChange={(hero) => set('hero', hero)} />
          </Section>
        </div>
      )}

      {tab === 'body' && (
        <Section
          title="The body"
          description="Blocks rather than one box of rich text, because the design draws each kind its own way — and because a facts table is something a search engine and an assistant can read, where a paragraph of the same numbers is not."
        >
          <BlockEditor blocks={form.body} onChange={(body) => set('body', body)} />
        </Section>
      )}

      {tab === 'links' && (
        <div className="space-y-5">
          <Section title="Tags" description="Comma-separated. Not read by a search engine; useful to the next person.">
            <Input value={form.tags} onChange={(event) => set('tags', event.target.value)} />
          </Section>

          <Section
            title="Journeys this entry is about"
            description="Puts a link to the entry on those journeys, and a link to them at the foot of this one."
          >
            <div className="space-y-2">
              {trips.map((trip) => (
                <label key={trip.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.relatedTripIds.includes(trip.id)}
                    onCheckedChange={(checked) =>
                      set(
                        'relatedTripIds',
                        checked === true
                          ? [...form.relatedTripIds, trip.id]
                          : form.relatedTripIds.filter((id) => id !== trip.id),
                      )
                    }
                  />
                  {trip.title}
                </label>
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === 'seo' && (
        <SeoPanel
            kind="post"
          value={form.seo}
          onChange={(patch) => set('seo', { ...form.seo, ...patch })}
          inherited={{ title: form.title, description: form.standfirst }}
          ogImage={form.ogImage}
          onOgImage={(media) => set('ogImage', media)}
          url={publicUrl}
        />
      )}
    </EditorShell>
  );
}
