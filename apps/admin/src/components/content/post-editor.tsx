'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { LinkPicker, type LinkOption } from '@/components/content/link-picker';
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
  category: 'JOURNEYS' | 'TRAVEL_GUIDES' | 'EXPERIENCES' | 'STORIES';
  body: string;
  hero: PickedMedia | null;
  ogImage: PickedMedia | null;
  authorId: string | null;
  tags: string;
  relatedTripIds: string[];
  destinationIds: string[];
  cultureIds: string[];
  featured: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  seo: SeoValue;
}

/** The words in a body, for the badge on the Body tab. */
function countWords(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

const TABS = [
  { value: 'entry', label: 'Entry' },
  { value: 'body', label: 'Body' },
  { value: 'links', label: 'Links' },
  { value: 'seo', label: 'SEO' },
];

/**
 * The four shelves, with what belongs on each.
 *
 * Spelt out beside the select because the one mistake this structure exists
 * to prevent is a journal entry that is really a place: "Punakha Dzong" is a
 * page under Where we go, and "The morning we crossed to Punakha Dzong" is a
 * story about it.
 */
const CATEGORIES: { value: PostFormData['category']; label: string; hint: string }[] = [
  { value: 'JOURNEYS', label: 'Journeys', hint: 'A travel story or an itinerary, told after the fact.' },
  {
    value: 'TRAVEL_GUIDES',
    label: 'Travel guides',
    hint: 'Practical and search-shaped: permits, seasons, what it costs, what to bring.',
  },
  { value: 'EXPERIENCES', label: 'Experiences', hint: 'Something a visitor can do, and what it is actually like.' },
  { value: 'STORIES', label: 'Stories', hint: 'People, places and perspectives.' },
];

export function PostEditor({
  initial,
  authors,
  trips,
  places,
  culture,
  siteUrl,
  canPublish,
}: {
  initial: PostFormData;
  authors: { id: string; name: string }[];
  trips: { id: string; title: string }[];
  places: LinkOption[];
  culture: LinkOption[];
  siteUrl: string;
  canPublish: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();

  const [form, setForm] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [tab, setTab] = React.useState('entry');
  const bodyWords = React.useMemo(() => countWords(form.body), [form.body]);
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
        category: form.category,
        /* Sent as the editor wrote it. The derived `src` inside each figure is
           taken out server-side before the column is written — the column
           stores the media id, not a copy of the URL. */
        body: form.body,
        heroId: form.hero?.id ?? null,
        authorId: form.authorId,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        relatedTripIds: form.relatedTripIds,
        destinationIds: form.destinationIds,
        cultureIds: form.cultureIds,
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

      if (!initial.id) router.replace(`/journal/${result.post.id}/edit`);
      else router.refresh();
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
      backHref={form.id ? `/journal/${form.id}` : '/journal'}
      backLabel={form.id ? 'Back to the entry' : 'Journal'}
      title={form.title}
      subtitle={form.slug ? `/journal/${form.slug}` : 'Not saved yet'}
      /* Words, not `form.body.length`. That counted blocks when the body was
         an array and counts *characters* now it is a string — a badge reading
         "1970" on an entry of three hundred words. */
      tabs={TABS.map((item) =>
        item.value === 'body' ? { ...item, badge: bodyWords } : item,
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

            <Field
              label="Shelf"
              hint={`${CATEGORIES.find((c) => c.value === form.category)?.hint ?? ''} Where it is about is on the Links tab.`}
            >
              <Select
                value={form.category}
                onValueChange={(value) => set('category', value as PostFormData['category'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          description="The entry, written as one piece. Headings, lists, quotations, photographs, films and tables of any size — the same editor as everywhere else on the site. Every photograph and film carries its own description and caption; use the Describe button on it."
        >
          <RichTextEditor
            value={form.body}
            onChange={(body) => set('body', body)}
            placeholder="Write the entry…"
            minHeight="min-h-[60vh]"
          />
        </Section>
      )}

      {tab === 'links' && (
        <div className="space-y-5">
          <Section title="Tags" description="Comma-separated. Not read by a search engine; useful to the next person.">
            <Input value={form.tags} onChange={(event) => set('tags', event.target.value)} />
          </Section>

          <Section
            title="Places it is about"
            description="Valleys and the places inside them. The entry is listed on each of those pages, and links to them. Write about the place here; describe it on its own page."
          >
            <LinkPicker
              options={places}
              value={form.destinationIds}
              onChange={(ids) => set('destinationIds', ids)}
              empty="There are no places under Where we go yet."
            />
          </Section>

          <Section
            title="Culture it explains"
            description="The entry is listed on each culture piece's page, and links to it."
          >
            <LinkPicker
              options={culture}
              value={form.cultureIds}
              onChange={(ids) => set('cultureIds', ids)}
              empty="There are no culture pieces yet."
            />
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
