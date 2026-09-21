'use client';

import * as React from 'react';

import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field, Section } from '@/components/shared/editor-shell';
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
import { cn } from '@/lib/utils';

/**
 * The SEO tab, for every addressable thing.
 *
 * One component because the fields are the same on a journey, a journal entry,
 * a page, a destination and an activity — and because the *guidance* is the
 * expensive part. A length counter that says "58 / 60" is a counter; one that
 says what happens at 61 is a thing somebody learns from once.
 *
 * Three principles run through it:
 *
 * 1. **Show the inherited value.** Every field falls back to something — the
 *    title, the excerpt, the standfirst — and the placeholder is that value,
 *    greyed. An editor can see what the page will say before deciding whether
 *    to override it, which is what stops the whole team pasting the excerpt in
 *    twice.
 * 2. **Warn, do not block.** A long meta description is truncated by Google,
 *    not rejected. The counter turns amber; nothing refuses to save.
 * 3. **Say what a field does to the page.** `noindex` is the one field here
 *    that can quietly remove a page from search results, and it says so.
 */

export interface SeoValue {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageId: string | null;
  twitterCard: 'summary' | 'summary_large_image';
  keywords: string[];
  focusKeyword: string | null;
  sitemapPriority: number;
  sitemapChangeFreq:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
}

export interface SeoPanelProps {
  value: SeoValue;
  onChange: (patch: Partial<SeoValue>) => void;
  /** What the fields fall back to, so the placeholders can show it. */
  inherited: { title: string; description: string };
  ogImage: PickedMedia | null;
  onOgImage: (media: PickedMedia | null) => void;
  /** The public URL, for the canonical field's placeholder. */
  url: string;
}

/**
 * Google truncates a title at about 60 characters and a description at about
 * 155. Both are approximate — the real limit is pixels, and it differs by
 * device — so these are the point at which the counter turns amber, not a cap.
 */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 155;

export function SeoPanel({
  value,
  onChange,
  inherited,
  ogImage,
  onOgImage,
  url,
}: SeoPanelProps) {
  const title = value.metaTitle ?? '';
  const description = value.metaDescription ?? '';

  return (
    <div className="space-y-5">
      <Section
        title="How this appears in a search result"
        description="Left empty, each of these falls back to what the page already says — which is usually the right answer."
      >
        <Field
          label="Title"
          htmlFor="seo-title"
          hint={
            <Counter
              length={title.length || inherited.title.length}
              limit={TITLE_LIMIT}
              overflow="Longer than this and a search result cuts it off with an ellipsis."
            />
          }
        >
          <Input
            id="seo-title"
            value={title}
            placeholder={inherited.title}
            onChange={(event) => onChange({ metaTitle: event.target.value || null })}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="seo-description"
          hint={
            <Counter
              length={description.length || inherited.description.length}
              limit={DESCRIPTION_LIMIT}
              overflow="Longer than this and the end is cut off. The first sentence has to stand on its own."
            />
          }
        >
          <Textarea
            id="seo-description"
            value={description}
            placeholder={inherited.description}
            rows={3}
            onChange={(event) => onChange({ metaDescription: event.target.value || null })}
          />
        </Field>

        <SearchPreview
          url={url}
          title={title || inherited.title}
          description={description || inherited.description}
        />
      </Section>

      <Section
        title="How this appears when somebody shares it"
        description="On WhatsApp, Facebook, X and in a message preview. Left empty, these follow the two fields above."
      >
        <Field label="Shared title" htmlFor="og-title">
          <Input
            id="og-title"
            value={value.ogTitle ?? ''}
            placeholder={title || inherited.title}
            onChange={(event) => onChange({ ogTitle: event.target.value || null })}
          />
        </Field>

        <Field label="Shared description" htmlFor="og-description">
          <Textarea
            id="og-description"
            value={value.ogDescription ?? ''}
            placeholder={description || inherited.description}
            rows={2}
            onChange={(event) => onChange({ ogDescription: event.target.value || null })}
          />
        </Field>

        <MediaPicker
          label="Shared photograph"
          description="Shown in the preview card. 1200 × 630 or wider; anything narrower is cropped to it. Left empty, the page's own hero is used."
          value={ogImage}
          onChange={(media) => {
            onOgImage(media);
            onChange({ ogImageId: media?.id ?? null });
          }}
        />

        <Field
          label="Card size"
          hint="A large card shows the photograph above the title. A small one puts it beside."
        >
          <Select
            value={value.twitterCard}
            onValueChange={(next) =>
              onChange({ twitterCard: next as SeoValue['twitterCard'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary_large_image">Large photograph</SelectItem>
              <SelectItem value="summary">Small photograph</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section
        title="Indexing"
        description="What a search engine is allowed to do with this page."
      >
        <div className="flex items-start gap-2">
          <Checkbox
            id="seo-noindex"
            checked={value.noIndex}
            onCheckedChange={(checked) => onChange({ noIndex: checked === true })}
          />
          <div className="space-y-1">
            <label htmlFor="seo-noindex" className="text-sm">
              Keep this out of search results
            </label>
            <p className="text-xs text-muted-foreground">
              The page stays on the site and anybody with the link can read it. It is
              dropped from the sitemap and, once a search engine next visits, from its
              results — which can take weeks to undo.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="seo-nofollow"
            checked={value.noFollow}
            onCheckedChange={(checked) => onChange({ noFollow: checked === true })}
          />
          <div className="space-y-1">
            <label htmlFor="seo-nofollow" className="text-sm">
              Do not follow the links on this page
            </label>
            <p className="text-xs text-muted-foreground">
              Rarely what you want. It stops the pages this one links to being found
              through it.
            </p>
          </div>
        </div>

        <Field
          label="Canonical URL"
          htmlFor="seo-canonical"
          hint="For a page that deliberately repeats another. Left empty — which is almost always right — the page is its own canonical."
        >
          <Input
            id="seo-canonical"
            value={value.canonicalUrl ?? ''}
            placeholder={url}
            onChange={(event) => onChange({ canonicalUrl: event.target.value || null })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Sitemap priority"
            htmlFor="seo-priority"
            hint="0 to 1, relative to this site's other pages. A hint, not an instruction."
          >
            <Input
              id="seo-priority"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={value.sitemapPriority}
              onChange={(event) =>
                onChange({ sitemapPriority: Number(event.target.value) })
              }
            />
          </Field>

          <Field label="How often it changes" hint="Another hint. Be honest — it is checked.">
            <Select
              value={value.sitemapChangeFreq}
              onValueChange={(next) =>
                onChange({ sitemapChangeFreq: next as SeoValue['sitemapChangeFreq'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        title="Keywords"
        description="Not read by any search engine since about 2009. They are here because the AI and discovery screen uses them, and because they are a useful note to the next person about what this page is for."
      >
        <Field label="Focus keyword" htmlFor="seo-focus">
          <Input
            id="seo-focus"
            value={value.focusKeyword ?? ''}
            placeholder="bhutan meditation retreat"
            onChange={(event) => onChange({ focusKeyword: event.target.value || null })}
          />
        </Field>

        <Field label="Other keywords" hint="Comma-separated.">
          <Input
            value={value.keywords.join(', ')}
            onChange={(event) =>
              onChange({
                keywords: event.target.value
                  .split(',')
                  .map((word) => word.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      </Section>
    </div>
  );
}

function Counter({
  length,
  limit,
  overflow,
}: {
  length: number;
  limit: number;
  overflow: string;
}) {
  const over = length > limit;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn('tabular-nums', over && 'font-medium text-status-attention')}>
        {length} / {limit}
      </span>
      {over && <span className="text-status-attention">{overflow}</span>}
    </span>
  );
}

/**
 * What the result will look like.
 *
 * Approximate on purpose — the real rendering differs by device and by
 * whatever Google is testing this week. What it is for is the shape: an editor
 * who can see the description being cut off mid-word will fix it, and one
 * reading a character count will not.
 */
function SearchPreview({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Roughly how a result looks
      </p>
      <div className="max-w-[600px] space-y-0.5">
        <p className="truncate text-xs text-muted-foreground">
          {url.replace(/^https?:\/\//, '').replace(/\//g, ' › ')}
        </p>
        <p className="truncate text-[18px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
          {truncate(title, TITLE_LIMIT)}
        </p>
        <p className="text-[13px] leading-snug text-muted-foreground">
          {truncate(description, DESCRIPTION_LIMIT)}
        </p>
      </div>
    </div>
  );
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}
