'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Overview {
  counts: { trips: number; posts: number; pages: number; total: number };
  missingDescription: { kind: string; title: string; href: string }[];
  noIndexed: { kind: string; title: string; href: string }[];
  undescribedMedia: number;
  unresolved404s: number;
  siteUrl: string | null;
  hasSearchConsole: boolean;
  hasDefaultDescription: boolean;
}

/**
 * How findable and how quotable the site is.
 *
 * Not a score out of a hundred. Every row is a thing somebody can go and fix,
 * and every one of them is invisible on the page it affects — a journey with
 * no description looks fine and gets whatever a search engine scrapes off it;
 * a page marked noindex looks fine and is simply not there.
 *
 * The files at the bottom are the generative-engine half. They are generated
 * from published rows, so they are always current, and they are here so
 * somebody can actually look at what a model is being given.
 */
export function DiscoveryScreen({ siteUrl }: { siteUrl: string }) {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ['seo', 'overview'],
    queryFn: () => apiGet('/api/seo/overview'),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const checks: { ok: boolean; label: string; detail: React.ReactNode }[] = [
    {
      ok: data.hasDefaultDescription,
      label: 'The site has a default description',
      detail: data.hasDefaultDescription ? (
        'Used by any page that has not written its own.'
      ) : (
        <>
          Nothing set. <Link href="/settings/company" className="underline">Settings → Company</Link>{' '}
          → On the site.
        </>
      ),
    },
    {
      ok: data.missingDescription.length === 0,
      label: 'Every page says what it is about',
      detail:
        data.missingDescription.length === 0
          ? 'Each one has a description of its own, or something to fall back on.'
          : `${data.missingDescription.length} would show whatever a search engine scraped off the page.`,
    },
    {
      ok: data.undescribedMedia === 0,
      label: 'Every photograph is described',
      detail:
        data.undescribedMedia === 0 ? (
          'Nothing in the library is missing alt text.'
        ) : (
          <>
            {data.undescribedMedia} have none.{' '}
            <Link href="/media" className="underline">
              Open the library
            </Link>
            .
          </>
        ),
    },
    {
      ok: data.unresolved404s === 0,
      label: 'Nothing is being asked for that is not there',
      detail:
        data.unresolved404s === 0 ? (
          'No unresolved misses.'
        ) : (
          <>
            {data.unresolved404s} {data.unresolved404s === 1 ? 'address' : 'addresses'} 404.{' '}
            <Link href="/seo/redirects" className="underline">
              Look at them
            </Link>
            .
          </>
        ),
    },
    {
      ok: data.hasSearchConsole,
      label: 'Search Console is verified',
      detail: data.hasSearchConsole ? (
        'The verification tag is being published.'
      ) : (
        <>
          Not set. Google will not show you what it sees.{' '}
          <Link href="/settings/company" className="underline">
            Settings → Company
          </Link>{' '}
          → Integrations.
        </>
      ),
    },
  ];

  const files = [
    {
      path: '/sitemap.xml',
      label: 'Sitemap',
      what: `${data.counts.total} published pages, each with the date it last changed.`,
    },
    {
      path: '/robots.txt',
      label: 'robots.txt',
      what: 'What a crawler may read, and where the sitemap is.',
    },
    {
      path: '/llms.txt',
      label: 'llms.txt',
      what: 'The site in one screen for a generative engine: who the company is, and every page worth reading.',
    },
    {
      path: '/llms-full.txt',
      label: 'llms-full.txt',
      what: 'Every journey and journal entry as plain markdown, with the facts in tables rather than sentences.',
    },
    {
      path: '/feed.xml',
      label: 'Journal feed',
      what: 'RSS, so somebody can subscribe without an account.',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Journeys', data.counts.trips],
          ['Journal entries', data.counts.posts],
          ['Pages', data.counts.pages],
        ].map(([label, count]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label} published
            </p>
            <p className="mt-2 text-2xl font-medium tabular-nums">{count}</p>
          </div>
        ))}
      </div>

      <Section
        title="Checks"
        description="Each one is invisible on the page it affects, which is why they are gathered here."
      >
        <ul className="space-y-3">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-3">
              {check.ok ? (
                <Check className="mt-0.5 size-4 shrink-0 text-status-published" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-attention" />
              )}
              <div>
                <p className={cn('text-sm', !check.ok && 'font-medium')}>{check.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {data.noIndexed.length > 0 && (
        <Section
          title="Deliberately hidden"
          description="These are published and asking not to appear in search results. Usually intentional — worth checking that it still is."
        >
          <ul className="space-y-1.5 text-sm">
            {data.noIndexed.map((row) => (
              <li key={row.href}>
                <Link href={row.href} className="hover:underline">
                  <span className="text-muted-foreground">{row.kind}:</span> {row.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.missingDescription.length > 0 && (
        <Section
          title="No description to show"
          description="These have neither a meta description nor anything to fall back on, so a search result will show whatever it can scrape."
        >
          <ul className="space-y-1.5 text-sm">
            {data.missingDescription.map((row) => (
              <li key={row.href}>
                <Link href={row.href} className="hover:underline">
                  <span className="text-muted-foreground">{row.kind}:</span> {row.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="What machines are given"
        description="All five are generated from published rows, so they are current the moment something is published. Worth opening once to see what an assistant is actually reading."
      >
        <ul className="divide-y">
          {files.map((file) => (
            <li key={file.path} className="flex flex-wrap items-center gap-3 py-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{file.label}</p>
                <p className="text-xs text-muted-foreground">{file.what}</p>
              </div>
              <Button variant="ghost" size="sm" asChild className="shrink-0">
                <a href={`${siteUrl}${file.path}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Open
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
