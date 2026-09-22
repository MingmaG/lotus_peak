import {
  AlertTriangle,
  BookOpen,
  Inbox,
  Mountain,
  Images,
  PenLine,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { relativeTime } from '@/lib/format';
import { revalidationConfigured } from '@/lib/env';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/**
 * The first screen.
 *
 * Not a wall of charts. The question somebody opening this panel has is "what
 * needs me today", and the honest answer is a short list: enquiries nobody has
 * read, things that are still drafts, and anything misconfigured badly enough
 * that work will silently not reach the website.
 *
 * Every panel is behind the permission for the screen it links to, so a
 * Reservations login sees enquiries and no drafts, and an Editor sees the
 * reverse. A dashboard that shows a count somebody cannot open is a dashboard
 * that teaches them to ignore it.
 */
export default async function DashboardPage() {
  const user = await requireUser();

  const showEnquiries = can(user.permissions, 'enquiries.read');
  const showContent = can(user.permissions, 'trips.read');

  const [newEnquiries, recentEnquiries, drafts, counts, unresolved] = await Promise.all([
    showEnquiries
      ? db.enquiry.count({ where: { status: 'NEW', deletedAt: null } })
      : Promise.resolve(0),
    showEnquiries
      ? db.enquiry.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: { trip: { select: { title: true } } },
        })
      : Promise.resolve([]),
    showContent
      ? db.trip.findMany({
          where: { status: { not: 'PUBLISHED' }, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { id: true, title: true, status: true, updatedAt: true },
        })
      : Promise.resolve([]),
    showContent
      ? Promise.all([
          db.trip.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
          db.post.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
          db.media.count({ where: { deletedAt: null } }),
        ])
      : Promise.resolve([0, 0, 0] as const),
    can(user.permissions, 'seo.read')
      ? db.notFoundLog.count({ where: { resolved: false } })
      : Promise.resolve(0),
  ]);

  const [publishedTrips, publishedPosts, mediaCount] = counts;
  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="What is waiting, and what is still a draft."
      />

      {!revalidationConfigured() && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-status-attention/40 bg-status-attention/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-attention" />
          <div className="text-sm">
            <p className="font-medium">Publishing is not reaching the website.</p>
            <p className="mt-1 text-muted-foreground">
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                SITE_REVALIDATE_SECRET
              </code>{' '}
              is not set in the admin panel&rsquo;s environment, so a save is
              recorded but the site is not told about it. Pages will still pick
              the change up on their hourly refresh. Run{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                bash scripts/generate-secrets.sh
              </code>{' '}
              and put the same value in both apps.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showEnquiries && (
          <Stat
            label="Unread enquiries"
            value={newEnquiries}
            href="/enquiries?status=NEW"
            icon={Inbox}
            emphasis={newEnquiries > 0}
          />
        )}
        {showContent && (
          <>
            <Stat
              label="Journeys published"
              value={publishedTrips}
              href="/trips"
              icon={Mountain}
            />
            <Stat
              label="Journal entries"
              value={publishedPosts}
              href="/journal"
              icon={BookOpen}
            />
            <Stat
              label="Photographs"
              value={mediaCount}
              href="/media"
              icon={Images}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {showEnquiries && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Latest enquiries</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/enquiries">All</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {recentEnquiries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing yet. The contact form writes here.
                </p>
              ) : (
                <ul className="divide-y">
                  {recentEnquiries.map((enquiry) => (
                    <li key={enquiry.id}>
                      <Link
                        href={`/enquiries/${enquiry.id}`}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-sm hover:text-primary"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{enquiry.name}</span>
                          {enquiry.trip && (
                            <span className="text-muted-foreground">
                              {' '}
                              · {enquiry.trip.title}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {relativeTime(enquiry.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {showContent && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Not yet published</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/trips">All journeys</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {drafts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Every journey is published.
                </p>
              ) : (
                <ul className="divide-y">
                  {drafts.map((trip) => (
                    <li key={trip.id}>
                      <Link
                        href={`/trips/${trip.id}`}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-sm hover:text-primary"
                      >
                        <span className="min-w-0 flex-1 truncate">{trip.title}</span>
                        <StatusBadge status={trip.status} className="shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {unresolved > 0 && (
        <Card className="mt-6">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">
                {unresolved} {unresolved === 1 ? 'address is' : 'addresses are'} being
                asked for and not found
              </p>
              <p className="mt-1 text-muted-foreground">
                Ones with a referrer are real inbound links. A redirect keeps them.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href="/seo/redirects">
                <PenLine className="mr-2 size-3.5" />
                Look at them
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  href,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: number;
  href: string;
  icon: typeof Inbox;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-muted-foreground/60" aria-hidden />
      </div>
      <p
        className={
          emphasis
            ? 'mt-2 text-2xl font-medium tabular-nums text-primary'
            : 'mt-2 text-2xl font-medium tabular-nums'
        }
      >
        {value}
      </p>
    </Link>
  );
}

/**
 * Bhutan Standard Time, which is where the people reading this are.
 *
 * UTC+6, with no daylight saving, so the offset is a constant rather than a
 * timezone database lookup — and a server rendering in UTC would otherwise
 * wish somebody good morning at four in the afternoon.
 */
function greeting(): string {
  const bhutanHour = (new Date().getUTCHours() + 6) % 24;
  if (bhutanHour < 12) return 'Good morning';
  if (bhutanHour < 17) return 'Good afternoon';
  return 'Good evening';
}
