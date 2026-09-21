'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { SectionEditor, type PageSection } from './section-editor';
import { SeoPanel, type SeoValue } from '@/components/content/seo-panel';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { EditorShell, Field, PublishProblems, Section } from '@/components/shared/editor-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiPatch, apiPost } from '@/lib/api-client';

export interface PageFormData {
  id: string | null;
  slug: string;
  path: string;
  title: string;
  eyebrow: string;
  lead: string;
  sections: PageSection[];
  hero: PickedMedia | null;
  ogImage: PickedMedia | null;
  isSystem: boolean;
  showInSitemap: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  seo: SeoValue;
}

const TABS = [
  { value: 'page', label: 'Page' },
  { value: 'bands', label: 'Bands' },
  { value: 'seo', label: 'SEO' },
];

export function PageEditor({
  initial,
  trips,
  reflections,
  people,
  siteUrl,
  canPublish,
}: {
  initial: PageFormData;
  trips: { slug: string; title: string }[];
  reflections: { id: string; name: string; quote: string }[];
  people: { id: string; name: string }[];
  siteUrl: string;
  canPublish: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();

  const [form, setForm] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [tab, setTab] = React.useState('page');
  const [problems, setProblems] = React.useState<Record<string, string>>({});

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof PageFormData>(key: K, value: PageFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        path: form.path,
        eyebrow: form.eyebrow || null,
        lead: form.lead || null,
        /* Sections lose their editing key and their photographs become ids. */
        sections: form.sections
          .map((section) => {
            const { key: _key, ...rest } = section;
            if (rest.kind === 'figure') {
              return rest.media
                ? { kind: 'figure', mediaId: rest.media.id, caption: rest.caption, width: rest.width }
                : null;
            }
            if (rest.kind === 'gallery') {
              return {
                kind: 'gallery',
                title: rest.title,
                items: rest.items.map((item) => ({
                  mediaId: item.media.id,
                  ratio: item.ratio,
                  width: item.width,
                })),
              };
            }
            return rest;
          })
          .filter(Boolean),
        heroId: form.hero?.id ?? null,
        showInSitemap: form.showInSitemap,
        status: form.status,
        seo: { ...form.seo, ogImageId: form.ogImage?.id ?? null },
      };

      type Result = {
        page: { id: string; path: string };
        revalidated?: { ok: boolean; detail?: string };
      };

      return form.id
        ? apiPatch<Result>(`/api/pages/${form.id}`, payload)
        : apiPost<Result>('/api/pages', payload);
    },
    onSuccess: (result) => {
      setProblems({});
      const next = { ...form, id: result.page.id, path: result.page.path };
      setForm(next);
      setSaved(next);
      void client.invalidateQueries({ queryKey: ['pages'] });

      if (result.revalidated && !result.revalidated.ok) {
        toast.warning('Saved, but the website was not told', {
          description: result.revalidated.detail,
        });
      } else {
        toast.success('Saved');
      }

      if (!initial.id) router.replace(`/pages/${result.page.id}`);
    },
    onError: (error: Error) => {
      if (error instanceof ApiClientError && error.fields) setProblems(error.fields);
      toast.error(error.message, { duration: 6_000 });
    },
  });

  const publicUrl = `${siteUrl}${form.path}`;

  return (
    <EditorShell
      backHref="/pages"
      backLabel="Pages"
      title={form.title}
      subtitle={form.path}
      tabs={TABS.map((item) =>
        item.value === 'bands' ? { ...item, badge: form.sections.length } : item,
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
      previewUrl={form.id ? `/api/preview/page/${form.id}` : null}
      notice={<PublishProblems problems={problems} onDismiss={() => setProblems({})} />}
    >
      {tab === 'page' && (
        <div className="space-y-5">
          <Section title="The top of the page">
            <Field label="Title">
              <Input value={form.title} onChange={(event) => set('title', event.target.value)} />
            </Field>

            <Field
              label="Address"
              hint={
                form.isSystem
                  ? 'This is one of the site’s fixed routes, so its address cannot change. Everything on it can.'
                  : 'Changing it moves the page. A permanent redirect is written for you.'
              }
            >
              <Input
                value={form.path}
                disabled={form.isSystem}
                onChange={(event) => set('path', event.target.value)}
              />
            </Field>

            <Field label="Eyebrow" hint="The small line above the title.">
              <Input value={form.eyebrow} onChange={(event) => set('eyebrow', event.target.value)} />
            </Field>

            <Field
              label="Standfirst"
              hint="The paragraph under the title. Also the default meta description."
            >
              <Textarea
                value={form.lead}
                rows={3}
                onChange={(event) => set('lead', event.target.value)}
              />
            </Field>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={form.showInSitemap}
                onCheckedChange={(checked) => set('showInSitemap', checked === true)}
              />
              <span>
                List it in the sitemap
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Off for a page that exists but should not be advertised — a landing page for
                  one campaign, say.
                </span>
              </span>
            </label>
          </Section>

          <Section title="The photograph at the top">
            <MediaPicker value={form.hero} onChange={(hero) => set('hero', hero)} />
          </Section>
        </div>
      )}

      {tab === 'bands' && (
        <Section
          title="Bands"
          description="The page, top to bottom. Ten kinds, and no eleventh — the design has styles for these and nothing else, so a page built from them is a page that looks like the site."
        >
          <SectionEditor
            sections={form.sections}
            onChange={(sections) => set('sections', sections)}
            trips={trips}
            reflections={reflections}
            people={people}
          />
        </Section>
      )}

      {tab === 'seo' && (
        <SeoPanel
          value={form.seo}
          onChange={(patch) => set('seo', { ...form.seo, ...patch })}
          inherited={{ title: form.title, description: form.lead }}
          ogImage={form.ogImage}
          onOgImage={(media) => set('ogImage', media)}
          url={publicUrl}
        />
      )}
    </EditorShell>
  );
}
