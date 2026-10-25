'use client';

import { CatalogueScreen } from '@/components/content/catalogue';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { BannerPreview, THEMES, type Layout, type Placement, type Theme } from './notice-preview';
import {
  BLANK_SCHEDULE,
  NoticeStatus,
  ScheduleFields,
  pagesSummary,
  scheduleToBody,
  scheduleToForm,
  type ScheduleForm,
} from './schedule';

interface Row {
  id: string;
  name: string;
  placement: Placement;
  layout: Layout;
  theme: Theme;
  eyebrow: string | null;
  heading: string;
  body: string;
  image: PickedMedia | null;
  href: string | null;
  linkLabel: string | null;
  secondaryHref: string | null;
  secondaryLabel: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  showOn: string[];
  hideOn: string[];
  [key: string]: unknown;
}

interface Form extends ScheduleForm {
  name: string;
  placement: Placement;
  layout: Layout;
  theme: Theme;
  eyebrow: string;
  heading: string;
  body: string;
  image: PickedMedia | null;
  href: string;
  linkLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  isNew: boolean;
}

const PLACEMENTS: { value: Placement; label: string; hint: string }[] = [
  { value: 'PAGE_END', label: 'Above the footer', hint: 'A band at the end of the page. Quiet, and seen by everyone who reads to the end.' },
  { value: 'POPUP', label: 'Pop-up', hint: 'Opens once, a few seconds in. Closed, it stays closed for that visitor until you edit it.' },
];

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: 'IMAGE_RIGHT', label: 'Photograph right' },
  { value: 'IMAGE_LEFT', label: 'Photograph left' },
  { value: 'BACKDROP', label: 'Photograph behind' },
];

/** A thumbnail sketch of each layout, so the choice is visual. */
function LayoutSketch({ layout }: { layout: Layout }) {
  const lines = (
    <span className="flex flex-1 flex-col justify-center gap-1 p-1.5">
      <span className="h-1 w-3/4 rounded bg-current opacity-60" />
      <span className="h-0.5 w-full rounded bg-current opacity-30" />
      <span className="h-0.5 w-2/3 rounded bg-current opacity-30" />
    </span>
  );
  const photo = <span className="w-2/5 bg-gradient-to-br from-sky-300 to-emerald-300" />;
  if (layout === 'BACKDROP') {
    return (
      <span className="relative flex h-12 w-full overflow-hidden rounded bg-gradient-to-br from-sky-400 to-emerald-400 text-white">
        <span className="absolute inset-0 bg-gradient-to-r from-sky-950/80 to-transparent" />
        <span className="relative flex w-3/5">{lines}</span>
      </span>
    );
  }
  return (
    <span className="flex h-12 w-full overflow-hidden rounded border bg-background text-foreground">
      {layout === 'IMAGE_LEFT' && photo}
      {lines}
      {layout === 'IMAGE_RIGHT' && photo}
    </span>
  );
}

/**
 * Promotions with room in them: a photograph, a heading, a paragraph, links.
 *
 * Two places to put one. Above the footer is the default, because it costs a
 * visitor nothing; a pop-up interrupts, so it opens once and late, and the
 * website never shows more than one pop-up on a page.
 */
export function BannersScreen({
  canWrite,
  canDelete,
  editId,
}: {
  canWrite: boolean;
  canDelete: boolean;
  editId?: string | null;
}) {
  return (
    <CatalogueScreen<Row, Form>
      endpoint="/api/banners"
      queryKey="banners"
      basePath="/banners"
      title="Banners"
      description="Promotions with a photograph and a paragraph — above the footer, or as a pop-up. Earlier in this list wins where two would share a place."
      editId={editId}
      primary={(row) => row.name || row.heading}
      thumbnail={(row) => row.image?.thumbnailUrl ?? row.image?.url ?? null}
      secondary={(row) => (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <NoticeStatus row={row} />
          <span className="text-xs">{PLACEMENTS.find((p) => p.value === row.placement)?.label}</span>
          <span className="truncate text-xs">{pagesSummary(row)}</span>
        </span>
      )}
      addLabel="New banner"
      emptyTitle="No banners yet"
      emptyDescription="A banner is a photograph and a few lines with a link — a season's offer, a new journey, a festival worth travelling for."
      editTitle={(form) => (form.isNew ? 'A new banner' : form.name || form.heading || 'Banner')}
      canWrite={canWrite}
      canDelete={canDelete}
      blank={() => ({
        name: '',
        placement: 'PAGE_END',
        layout: 'IMAGE_RIGHT',
        theme: 'MIST',
        eyebrow: '',
        heading: '',
        body: '',
        image: null,
        href: '',
        linkLabel: '',
        secondaryHref: '',
        secondaryLabel: '',
        ...BLANK_SCHEDULE,
        isNew: true,
      })}
      toForm={(row) => ({
        name: row.name,
        placement: row.placement,
        layout: row.layout,
        theme: row.theme,
        eyebrow: row.eyebrow ?? '',
        heading: row.heading,
        body: row.body,
        image: row.image,
        href: row.href ?? '',
        linkLabel: row.linkLabel ?? '',
        secondaryHref: row.secondaryHref ?? '',
        secondaryLabel: row.secondaryLabel ?? '',
        ...scheduleToForm(row),
        isNew: false,
      })}
      toBody={(form) => ({
        name: form.name,
        placement: form.placement,
        layout: form.layout,
        theme: form.theme,
        eyebrow: form.eyebrow || null,
        heading: form.heading,
        body: form.body,
        imageId: form.image?.id ?? null,
        href: form.href || null,
        linkLabel: form.linkLabel || null,
        secondaryHref: form.secondaryHref || null,
        secondaryLabel: form.secondaryLabel || null,
        ...scheduleToBody(form),
      })}
      renderForm={(form, set) => (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="space-y-6">
            <Field label="Name" hint="What it is called in this list. Visitors never see it.">
              <Input
                value={form.name}
                placeholder="Autumn tshechu journeys"
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>

            <Field label="Where it appears">
              <div className="grid gap-2 sm:grid-cols-2">
                {PLACEMENTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={form.placement === option.value}
                    onClick={() => set({ placement: option.value })}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      form.placement === option.value ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                    )}
                  >
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            <MediaPicker
              label="Photograph"
              description="Optional. Landscape works best; the focal point you set in the library is kept when it is cropped."
              value={form.image}
              onChange={(image) => set({ image })}
            />

            {form.image && form.placement === 'PAGE_END' && (
              <Field label="Layout">
                <div className="grid grid-cols-3 gap-2">
                  {LAYOUTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={form.layout === option.value}
                      onClick={() => set({ layout: option.value })}
                      className={cn(
                        'space-y-1.5 rounded-lg border p-2 text-left transition-colors',
                        form.layout === option.value ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                      )}
                    >
                      <LayoutSketch layout={option.value} />
                      <span className="block text-xs">{option.label}</span>
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {!(form.image && form.layout === 'BACKDROP' && form.placement === 'PAGE_END') && (
              <Field label="Ground" hint="The three the design allows a section.">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(THEMES) as Theme[]).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      aria-pressed={form.theme === theme}
                      onClick={() => set({ theme })}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors',
                        form.theme === theme ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                      )}
                    >
                      <span className="size-6 rounded-full border" style={{ background: THEMES[theme].bg }} />
                      {THEMES[theme].label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <Field label="Eyebrow" hint="Above the heading.">
                <Input
                  value={form.eyebrow}
                  maxLength={60}
                  placeholder="Autumn 2026"
                  onChange={(event) => set({ eyebrow: event.target.value })}
                />
              </Field>
              <Field label="Heading">
                <Input
                  value={form.heading}
                  maxLength={140}
                  placeholder="The valleys in festival season"
                  onChange={(event) => set({ heading: event.target.value })}
                />
              </Field>
            </div>

            <Field label="Words" hint="A paragraph or two. Bold, links and lists work; keep it short.">
              <RichTextEditor
                value={form.body}
                onChange={(body) => set({ body })}
                compact
                minHeight="min-h-[120px]"
                placeholder="What it is, and why now."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Main link" hint="A path, or a full address.">
                <Input
                  value={form.href}
                  placeholder="/trips/autumn-festivals"
                  onChange={(event) => set({ href: event.target.value })}
                />
              </Field>
              <Field label="Its words" hint="Empty: the whole banner becomes the link.">
                <Input
                  value={form.linkLabel}
                  maxLength={40}
                  placeholder="See the journeys"
                  onChange={(event) => set({ linkLabel: event.target.value })}
                />
              </Field>
              <Field label="Second link" hint="Optional, drawn as a quieter text link beside the button.">
                <Input
                  value={form.secondaryHref}
                  placeholder="/contact"
                  onChange={(event) => set({ secondaryHref: event.target.value })}
                />
              </Field>
              <Field label="Its words">
                <Input
                  value={form.secondaryLabel}
                  maxLength={40}
                  placeholder="Ask us"
                  onChange={(event) => set({ secondaryLabel: event.target.value })}
                />
              </Field>
            </div>

            <div className="border-t pt-6">
              <h3 className="mb-4 text-sm font-semibold">When and where</h3>
              <ScheduleFields form={form} set={set} noun="banner" />
            </div>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
            <BannerPreview
              placement={form.placement}
              layout={form.layout}
              theme={form.theme}
              eyebrow={form.eyebrow}
              heading={form.heading}
              body={form.body}
              imageUrl={form.image?.url ?? null}
              href={form.href}
              linkLabel={form.linkLabel}
              secondaryLabel={form.secondaryHref ? form.secondaryLabel : ''}
            />
            <p className="text-xs text-muted-foreground">
              A sketch in the website&rsquo;s colours. On a phone the photograph sits above the words.
            </p>
          </aside>
        </div>
      )}
    />
  );
}
