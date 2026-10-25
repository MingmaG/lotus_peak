'use client';

import { CalendarClock, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Field } from '@/components/shared/editor-shell';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * What announcements and banners have in common: whether they are on, the
 * dates they run between, and which pages they appear on.
 *
 * One component for both screens, because the rule the office learns on one
 * — `/trips/*` is every journey, an empty list is every page — has to be the
 * rule on the other, and the website reads both with the same function.
 */

export interface ScheduleForm {
  isActive: boolean;
  /** `YYYY-MM-DDTHH:mm`, in the browser's own time zone, or empty. */
  startsAt: string;
  endsAt: string;
  showOn: string[];
  hideOn: string[];
}

export interface ScheduleRow {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  showOn: string[];
  hideOn: string[];
}

/* ------------------------------------------------------------------ dates */

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO instant as `<input type="datetime-local">` wants it: local, no zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The other way. A local wall-clock time becomes an instant on Save. */
export function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function scheduleToForm(row: ScheduleRow): ScheduleForm {
  return {
    isActive: row.isActive,
    startsAt: toLocalInput(row.startsAt),
    endsAt: toLocalInput(row.endsAt),
    showOn: row.showOn,
    hideOn: row.hideOn,
  };
}

export function scheduleToBody(form: ScheduleForm) {
  return {
    isActive: form.isActive,
    startsAt: fromLocalInput(form.startsAt),
    endsAt: fromLocalInput(form.endsAt),
    showOn: form.showOn,
    hideOn: form.hideOn,
  };
}

export const BLANK_SCHEDULE: ScheduleForm = {
  isActive: false,
  startsAt: '',
  endsAt: '',
  showOn: [],
  hideOn: [],
};

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/* ------------------------------------------------------------------ state */

export type NoticeState = 'live' | 'scheduled' | 'ended' | 'off';

/** Where a row is in its life, now. The same test the website makes. */
export function noticeState(row: ScheduleRow, now = Date.now()): NoticeState {
  if (!row.isActive) return 'off';
  if (row.endsAt && Date.parse(row.endsAt) <= now) return 'ended';
  if (row.startsAt && Date.parse(row.startsAt) > now) return 'scheduled';
  return 'live';
}

const STATE_STYLE: Record<NoticeState, string> = {
  live: 'border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  scheduled: 'border-sky-600/30 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  ended: 'border-border bg-muted text-muted-foreground',
  off: 'border-border bg-background text-muted-foreground',
};

const STATE_LABEL: Record<NoticeState, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  ended: 'Ended',
  off: 'Off',
};

/** A pill, and the sentence that goes with it — "until 3 Nov, 18:00". */
export function NoticeStatus({ row }: { row: ScheduleRow }) {
  const state = noticeState(row);
  const when =
    state === 'scheduled' && row.startsAt
      ? `from ${DATE.format(new Date(row.startsAt))}`
      : state === 'live' && row.endsAt
        ? `until ${DATE.format(new Date(row.endsAt))}`
        : state === 'ended' && row.endsAt
          ? `on ${DATE.format(new Date(row.endsAt))}`
          : null;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
          STATE_STYLE[state],
        )}
      >
        {state === 'live' && <span className="size-1.5 rounded-full bg-emerald-600" />}
        {STATE_LABEL[state]}
      </span>
      {when && <span className="text-xs text-muted-foreground">{when}</span>}
    </span>
  );
}

export function pagesSummary(row: Pick<ScheduleRow, 'showOn' | 'hideOn'>): string {
  const on = row.showOn.length === 0 ? 'Every page' : row.showOn.join(', ');
  return row.hideOn.length ? `${on} · not ${row.hideOn.join(', ')}` : on;
}

/* ----------------------------------------------------------------- fields */

/** The "this needs to run for a week" shortcuts, from now. */
const PRESETS: { label: string; days: number }[] = [
  { label: '1 day', days: 1 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

export function ScheduleFields({
  form,
  set,
  noun,
}: {
  form: ScheduleForm;
  set: (patch: Partial<ScheduleForm>) => void;
  /** "announcement", "banner" — for the sentences. */
  noun: string;
}) {
  const zone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const invalid =
    form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)
      ? 'It has to end after it starts.'
      : undefined;

  function preset(days: number) {
    const start = form.startsAt ? new Date(form.startsAt) : new Date();
    const end = new Date(start.getTime() + days * 86_400_000);
    set({
      startsAt: form.startsAt || toLocalInput(start.toISOString()),
      endsAt: toLocalInput(end.toISOString()),
    });
  }

  return (
    <div className="space-y-5">
      <label className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
        <span>
          <span className="block text-sm font-medium">Show it on the website</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Off keeps the {noun} here without showing it anywhere. On, it appears between the dates
            below — or straight away and until you switch it off, if they are empty.
          </span>
        </span>
        <Switch checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" hint="Empty: as soon as it is switched on.">
          <Input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => set({ startsAt: event.target.value })}
          />
        </Field>
        <Field label="Ends" hint="Empty: until it is switched off." error={invalid}>
          <Input
            type="datetime-local"
            value={form.endsAt}
            min={form.startsAt || undefined}
            onChange={(event) => set({ endsAt: event.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" />
        <span>Run it for</span>
        {PRESETS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => preset(option.days)}
            className="rounded-full border px-2.5 py-0.5 hover:border-primary/40 hover:text-foreground"
          >
            {option.label}
          </button>
        ))}
        {(form.startsAt || form.endsAt) && (
          <button
            type="button"
            onClick={() => set({ startsAt: '', endsAt: '' })}
            className="rounded-full px-2 py-0.5 underline-offset-2 hover:underline"
          >
            Clear dates
          </button>
        )}
        <span className="ml-auto">Times are {zone}.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Only on these pages"
          hint={
            <>
              Empty is every page. <code>/trips/*</code> is every journey; <code>/</code> is the
              home page alone.
            </>
          }
        >
          <PathsInput value={form.showOn} onChange={(showOn) => set({ showOn })} placeholder="/trips/*" />
        </Field>
        <Field label="Never on these pages" hint="Wins over the list beside it.">
          <PathsInput value={form.hideOn} onChange={(hideOn) => set({ hideOn })} placeholder="/contact" />
        </Field>
      </div>
    </div>
  );
}

const PATH = /^\/[a-z0-9\-/]*(\/\*)?$/i;

/** Paths as chips. Enter or a comma adds one; Backspace on empty removes the last. */
function PathsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (paths: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  function commit() {
    let path = draft.trim();
    if (!path) return;
    if (!path.startsWith('/')) path = `/${path}`;
    /* "/trips/" and "/trips" are one page; the website compares without it. */
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    if (!PATH.test(path)) {
      setError('A path such as /trips or /trips/* — no spaces, no address.');
      return;
    }
    if (!value.includes(path)) onChange([...value, path]);
    setDraft('');
    setError(null);
  }

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
        {value.map((path) => (
          <span
            key={path}
            className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
          >
            {path}
            <button
              type="button"
              aria-label={`Remove ${path}`}
              onClick={() => onChange(value.filter((one) => one !== path))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? '' : placeholder}
          className="min-w-24 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- tabs */

/** The two screens are one job, so each carries a way to the other. */
export function NoticeTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: '/announcements', label: 'Announcements', hint: 'The bar above the navigation' },
    { href: '/banners', label: 'Banners', hint: 'Above the footer, or a pop-up' },
  ];
  return (
    <nav className="mb-6 flex gap-1 border-b" aria-label="Notices on the website">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            <span className="ml-2 hidden text-xs font-normal text-muted-foreground md:inline">
              {tab.hint}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
