'use client';

import { CatalogueScreen } from '@/components/content/catalogue';
import { Field } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { NoticeEditor } from './notice-editor';
import { AnnouncementPreview, TONES, type Tone } from './notice-preview';
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
  label: string | null;
  message: string;
  href: string | null;
  linkLabel: string | null;
  tone: Tone;
  dismissible: boolean;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  showOn: string[];
  hideOn: string[];
  [key: string]: unknown;
}

interface Form extends ScheduleForm {
  name: string;
  label: string;
  message: string;
  href: string;
  linkLabel: string;
  tone: Tone;
  dismissible: boolean;
  isNew: boolean;
}

/** The words of a message without its markup, for a row in the list. */
function plain(html: string): string {
  return html
    .replace(/<\/p>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The bar above the website's navigation.
 *
 * Several can be live at once; the website shows them one at a time in the
 * order of this list, turning slowly, so the order is the priority. Each runs
 * between its own dates, on its own pages.
 */
export function AnnouncementsScreen({
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
      endpoint="/api/announcements"
      queryKey="announcements"
      basePath="/announcements"
      title="Announcements"
      description="The bar above the navigation. When more than one is live they take turns, in this order — drag to change it."
      editId={editId}
      primary={(row) => row.name || plain(row.message).slice(0, 80) || 'Untitled'}
      secondary={(row) => (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <NoticeStatus row={row} />
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="size-2.5 rounded-full border" style={{ background: TONES[row.tone].bg }} />
            {TONES[row.tone].label}
          </span>
          <span className="truncate text-xs">{pagesSummary(row)}</span>
          {row.name && <span className="block w-full truncate text-xs">{plain(row.message)}</span>}
        </span>
      )}
      addLabel="New announcement"
      emptyTitle="Nothing to announce"
      emptyDescription="An announcement is a line or two above the navigation — an offer, a festival, a road that is closed — shown between two dates."
      editTitle={(form) => (form.isNew ? 'A new announcement' : form.name || 'Announcement')}
      canWrite={canWrite}
      canDelete={canDelete}
      blank={() => ({
        name: '',
        label: '',
        message: '',
        href: '',
        linkLabel: '',
        tone: 'GENERAL',
        dismissible: true,
        ...BLANK_SCHEDULE,
        isNew: true,
      })}
      toForm={(row) => ({
        name: row.name,
        label: row.label ?? '',
        message: row.message,
        href: row.href ?? '',
        linkLabel: row.linkLabel ?? '',
        tone: row.tone,
        dismissible: row.dismissible,
        ...scheduleToForm(row),
        isNew: false,
      })}
      toBody={(form) => ({
        name: form.name,
        label: form.label || null,
        message: form.message,
        href: form.href || null,
        linkLabel: form.linkLabel || null,
        tone: form.tone,
        dismissible: form.dismissible,
        ...scheduleToBody(form),
      })}
      renderForm={(form, set) => (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="space-y-6">
            <Field label="Name" hint="What it is called in this list. Visitors never see it.">
              <Input
                value={form.name}
                placeholder="Losar early-booking offer"
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>

            <Field label="Kind" hint="Chooses the colours. The website keeps them to its own palette.">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(TONES) as Tone[]).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    aria-pressed={form.tone === tone}
                    onClick={() =>
                      set({
                        tone,
                        /* A label the office has not written follows the kind;
                           one they have written is theirs. */
                        label:
                          !form.label || Object.values(TONES).some((t) => t.label === form.label)
                            ? tone === 'GENERAL'
                              ? ''
                              : TONES[tone].label
                            : form.label,
                      })
                    }
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                      form.tone === tone ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                    )}
                  >
                    <span
                      className="mt-0.5 size-5 shrink-0 rounded-full border"
                      style={{ background: TONES[tone].bg, boxShadow: `inset 0 0 0 5px ${TONES[tone].bg}, inset 0 0 0 9px ${TONES[tone].chipBg}` }}
                    />
                    <span>
                      <span className="block text-sm font-medium">{TONES[tone].label}</span>
                      <span className="block text-xs text-muted-foreground">{TONES[tone].hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Label" hint="A short word before the message. Optional." className="max-w-xs">
              <Input
                value={form.label}
                maxLength={30}
                placeholder="Offer"
                onChange={(event) => set({ label: event.target.value })}
              />
            </Field>

            <Field
              label="Message"
              hint="One line is best; three is the most a bar has room for. Choose a size per line — Headline for the offer, Small for its terms."
            >
              <NoticeEditor value={form.message} onChange={(message) => set({ message })} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link" hint="Where the button goes. A path, or a full address.">
                <Input
                  value={form.href}
                  placeholder="/trips/punakha-tshechu"
                  onChange={(event) => set({ href: event.target.value })}
                />
              </Field>
              <Field label="Link words" hint="“Read more” when left empty.">
                <Input
                  value={form.linkLabel}
                  maxLength={60}
                  placeholder="See the dates"
                  onChange={(event) => set({ linkLabel: event.target.value })}
                />
              </Field>
            </div>

            <label className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <span>
                <span className="block text-sm font-medium">Visitors may close it</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Closed stays closed for that visitor until you edit it. Switch this off for something
                  nobody should miss — a closure, a changed rule.
                </span>
              </span>
              <Switch checked={form.dismissible} onCheckedChange={(dismissible) => set({ dismissible })} />
            </label>

            <div className="border-t pt-6">
              <h3 className="mb-4 text-sm font-semibold">When and where</h3>
              <ScheduleFields form={form} set={set} noun="announcement" />
            </div>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
            <AnnouncementPreview
              tone={form.tone}
              label={form.label}
              message={form.message}
              href={form.href}
              linkLabel={form.linkLabel}
              dismissible={form.dismissible}
            />
            <p className="text-xs text-muted-foreground">
              Close to what the website draws, in its type and colours. On a phone the words wrap and
              the link moves beneath them.
            </p>
          </aside>
        </div>
      )}
    />
  );
}
