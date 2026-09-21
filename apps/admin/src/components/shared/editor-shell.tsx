'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  Loader2,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { ContentStatus } from '@prisma/client';

/**
 * The frame every editor sits in.
 *
 * A back link, tabs, a status control, Preview, Save — and, at the top of the
 * screen on a phone rather than the bottom, because a bar fixed to the bottom
 * of a mobile viewport is a bar underneath the on-screen keyboard exactly when
 * somebody wants to press Save.
 *
 * ## Save is a button, not an autosave
 *
 * Tempting, and wrong for this content. An autosave over a published journey
 * writes half-finished sentences to a live page; an autosave into a draft
 * copy means a draft/published split and a merge. What this does instead is
 * keep the button honest: it says whether there is anything to save, it warns
 * before a navigation that would lose work, and it never lets the page look
 * saved when it is not.
 */

export interface EditorTab {
  value: string;
  label: string;
  /** A count, or a `!` where the tab has a problem. */
  badge?: string | number;
  /** True colours the badge as a problem rather than a count. */
  alert?: boolean;
}

export interface EditorShellProps {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: React.ReactNode;

  tabs: EditorTab[];
  tab: string;
  onTab: (tab: string) => void;

  status?: ContentStatus;
  onStatus?: (status: ContentStatus) => void;
  /** False greys the Published option and says why on hover. */
  canPublish?: boolean;

  dirty: boolean;
  saving: boolean;
  onSave: () => void;

  /** The site URL, when this thing has a page. */
  viewUrl?: string | null;
  previewUrl?: string | null;

  /** Rendered under the bar — a publish-blocked list, usually. */
  notice?: React.ReactNode;

  children: React.ReactNode;
}

export function EditorShell({
  backHref,
  backLabel,
  title,
  subtitle,
  tabs,
  tab,
  onTab,
  status,
  onStatus,
  canPublish = true,
  dirty,
  saving,
  onSave,
  viewUrl,
  previewUrl,
  notice,
  children,
}: EditorShellProps) {
  /**
   * Warn before leaving with unsaved work.
   *
   * `beforeunload` covers a reload, a closed tab and an external link. It does
   * not cover Next's client-side navigation, which is why the back link below
   * asks as well — two mechanisms because neither covers the other's case.
   */
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /** ⌘S, because everybody tries it. */
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (dirty && !saving) onSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dirty, saving, onSave]);

  return (
    <div className="pb-10">
      <div className="sticky top-14 z-20 -mx-3 mb-5 border-b bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 shrink-0">
            <Link
              href={backHref}
              onClick={(event) => {
                if (!dirty) return;
                if (
                  !window.confirm(
                    'There are unsaved changes on this page. Leave without saving?',
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <ArrowLeft className="mr-1.5 size-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium sm:text-base">
              {title || <span className="text-muted-foreground">Untitled</span>}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {status && onStatus && (
              <Select value={status} onValueChange={(value) => onStatus(value as ContentStatus)}>
                <SelectTrigger className="h-8 w-32 text-xs" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="PUBLISHED" disabled={!canPublish}>
                    Published
                  </SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            )}

            {previewUrl && (
              <Button variant="outline" size="sm" asChild title="See it as the site draws it">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <Eye className="size-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Preview</span>
                </a>
              </Button>
            )}

            {viewUrl && (
              <Button variant="ghost" size="icon" asChild title="Open on the website">
                <a href={viewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  <span className="sr-only">Open on the website</span>
                </a>
              </Button>
            )}

            <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin sm:mr-1.5" />
              ) : dirty ? (
                <Save className="size-4 sm:mr-1.5" />
              ) : (
                <Check className="size-4 sm:mr-1.5" />
              )}
              <span className="hidden sm:inline">
                {saving ? 'Saving' : dirty ? 'Save' : 'Saved'}
              </span>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={onTab} className="mt-3">
          {/* Scrollable rather than wrapping: seven tabs on two lines pushes
              the form down the screen on every phone. */}
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="gap-1.5 text-xs">
                {item.label}
                {item.badge !== undefined && item.badge !== 0 && (
                  <span
                    className={cn(
                      'rounded px-1 text-[10px] tabular-nums',
                      item.alert
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {notice}

      <div className="max-w-4xl">{children}</div>
    </div>
  );
}

/**
 * Why something cannot be published yet.
 *
 * Every message names the field and says what it is for, because "meta
 * description is required" teaches nobody why a page needs one. It appears
 * when publishing is refused, and it does not disappear on the next keystroke
 * — the office should be able to read it while fixing the third item.
 */
export function PublishProblems({
  problems,
  onDismiss,
}: {
  problems: Record<string, string>;
  onDismiss: () => void;
}) {
  const entries = Object.entries(problems);
  if (entries.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-5 rounded-lg border border-status-attention/40 bg-status-attention/5 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-attention" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Not ready to publish — {entries.length}{' '}
            {entries.length === 1 ? 'thing' : 'things'} to sort out first
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {entries.map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="shrink-0">
          Dismiss
        </Button>
      </div>
    </div>
  );
}

/**
 * A labelled field.
 *
 * `hint` is under the label rather than under the input, so it is read before
 * the field is filled in rather than after.
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium leading-none"
      >
        {label}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** A titled group of fields, with an explanation of what the group is for. */
export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border bg-card p-4 sm:p-5', className)}>
      <div className="mb-4">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
