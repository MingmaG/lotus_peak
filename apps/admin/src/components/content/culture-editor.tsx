'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { RemoveButton } from '@/components/content/destination-editor';
import { IconSelect } from '@/components/content/icon-select';
import { LinkPicker, type LinkOption } from '@/components/content/link-picker';
import { SeoPanel, type SeoValue } from '@/components/content/seo-panel';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { EditorShell, Field, PublishProblems, Section } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiDelete, apiPatch, apiPost } from '@/lib/api-client';
import { toSlug } from '@/lib/slug';
import { culturePath } from '@/server/services/content-paths';

/**
 * A culture piece, on a page of its own.
 *
 * What makes Bhutan Bhutan — tshechu, dzongs, the thirteen arts — written
 * once, here. Where to see it is a list of ticks on the Links tab, which puts
 * the piece on those places' pages; the places are not described again here.
 */

export interface CultureFormData {
  id: string | null;
  slug: string;
  title: string;
  standfirst: string;
  body: string;
  icon: string;
  image: PickedMedia | null;
  ogImage: PickedMedia | null;
  destinationIds: string[];
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

export function CultureEditor({
  initial,
  places,
  siteUrl,
  canPublish,
  canDelete,
}: {
  initial: CultureFormData;
  places: LinkOption[];
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
  const set = <K extends keyof CultureFormData>(key: K, value: CultureFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const path = culturePath(form.slug || 'untitled');
  const bodyWords = React.useMemo(() => countWords(form.body), [form.body]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        slug: form.slug || toSlug(form.title),
        standfirst: form.standfirst,
        body: form.body,
        icon: form.icon,
        imageId: form.image?.id ?? null,
        destinationIds: form.destinationIds,
        status: form.status,
        seo: { ...form.seo, ogImageId: form.ogImage?.id ?? null },
      };
      type Result = {
        item: { id: string; slug: string };
        revalidated?: { ok: boolean; detail?: string };
      };
      return form.id
        ? apiPatch<Result>(`/api/culture/${form.id}`, payload)
        : apiPost<Result>('/api/culture', payload);
    },
    onSuccess: (result) => {
      setProblems({});
      const next = { ...form, id: result.item.id, slug: result.item.slug };
      setForm(next);
      setSaved(next);
      void client.invalidateQueries({ queryKey: ['culture'] });

      if (result.revalidated && !result.revalidated.ok) {
        toast.warning('Saved, but the website was not told', {
          description: result.revalidated.detail,
        });
      } else {
        toast.success('Saved');
      }

      if (!initial.id) router.replace(`/culture/${result.item.id}/edit`);
      else router.refresh();
    },
    onError: (error: Error) => {
      if (error instanceof ApiClientError && error.fields) setProblems(error.fields);
      toast.error(error.message);
    },
  });

  const destroy = useMutation({
    mutationFn: () => apiDelete(`/api/culture/${form.id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['culture'] });
      toast.success('Removed');
      router.push('/culture');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <EditorShell
      backHref={form.id ? `/culture/${form.id}` : '/culture'}
      backLabel={form.id ? 'Back to the page' : 'Culture'}
      title={form.title || 'A new piece'}
      subtitle={form.id ? path : 'Not saved yet'}
      tabs={[
        { value: 'page', label: 'The piece' },
        { value: 'body', label: 'Body', badge: bodyWords },
        { value: 'links', label: 'Where to see it', badge: form.destinationIds.length },
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
      previewUrl={form.id ? `/api/preview/culture/${form.id}` : null}
      notice={<PublishProblems problems={problems} onDismiss={() => setProblems({})} />}
    >
      {tab === 'page' && (
        <div className="space-y-5">
          <Section title="The piece">
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
              label="Address"
              hint={
                form.id
                  ? 'Changing it moves the page. A permanent redirect from the old address is written for you.'
                  : 'Built from the title.'
              }
            >
              <div className="flex items-center gap-1 text-sm">
                <span className="shrink-0 text-muted-foreground">/culture/</span>
                <Input
                  value={form.slug}
                  onChange={(event) => set('slug', toSlug(event.target.value))}
                />
              </div>
            </Field>

            <Field
              label="Standfirst"
              hint="The sentence under the title, on the card on /culture, and what a search result says unless the SEO tab overrides it."
              error={problems.standfirst}
            >
              <Textarea
                value={form.standfirst}
                rows={3}
                onChange={(event) => set('standfirst', event.target.value)}
              />
            </Field>

            <Field label="Silhouette">
              <IconSelect value={form.icon} onChange={(icon) => set('icon', icon)} />
            </Field>
          </Section>

          <Section title="The photograph at the top">
            <MediaPicker value={form.image} onChange={(image) => set('image', image)} />
          </Section>

          {form.id && canDelete && (
            <RemoveButton
              label="Remove this piece"
              onConfirm={() => destroy.mutate()}
              pending={destroy.isPending}
            />
          )}
        </div>
      )}

      {tab === 'body' && (
        <Section
          title="The page"
          description="What it is and what it means, in the voice the rest of the site uses. Particular places — Punakha Dzong, Paro Tshechu’s ground — have pages of their own; tick them on Where to see it rather than describing them again here."
        >
          <RichTextEditor
            value={form.body}
            onChange={(body) => set('body', body)}
            placeholder="Write the page…"
            minHeight="min-h-[60vh]"
          />
        </Section>
      )}

      {tab === 'links' && (
        <Section
          title="Where to see it"
          description="Each place ticked here lists this piece on its page, and this page links to each of them. A valley's page also lists what is linked to the places inside it."
        >
          <LinkPicker
            options={places}
            value={form.destinationIds}
            onChange={(ids) => set('destinationIds', ids)}
            empty="There are no places under Where we go yet."
          />
        </Section>
      )}

      {tab === 'seo' && (
        <SeoPanel
          kind="culture"
          value={form.seo}
          onChange={(patch) => set('seo', { ...form.seo, ...patch })}
          inherited={{ title: form.title, description: form.standfirst }}
          ogImage={form.ogImage}
          onOgImage={(media) => set('ogImage', media)}
          url={`${siteUrl}${path}`}
        />
      )}
    </EditorShell>
  );
}
