import {
  Building2,
  KeyRound,
  Mail,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mailConfigured, revalidationConfigured } from '@/lib/env';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

/**
 * Settings, and whether this install is actually wired up.
 *
 * The three checks at the bottom are the ones whose failure is silent:
 * publishing that never reaches the site, email that is written and not sent,
 * a media store nothing can read. Each of them looks like everything is
 * working right up until somebody asks why the site is out of date.
 */
export default async function SettingsPage() {
  const user = await requirePermission('settings.read');

  const [company, templates] = await Promise.all([
    db.companyProfile.findFirst({ select: { name: true, siteUrl: true } }),
    db.emailTemplate.count(),
  ]);

  const screens = [
    {
      href: '/settings/company',
      icon: Building2,
      title: 'Company',
      description:
        'Name, address, telephone, social links, office hours and the default SEO — once, for the whole site.',
      permission: 'settings.read' as const,
    },
    {
      href: '/emails/templates',
      icon: Mail,
      title: 'Email wording',
      description: `The ${templates} messages this site sends, in the office's own words.`,
      permission: 'emails.read' as const,
    },
    {
      href: '/users',
      icon: Users,
      title: 'Users',
      description: 'Who may sign in, and what they may do.',
      permission: 'users.read' as const,
    },
    {
      href: '/profile',
      icon: KeyRound,
      title: 'Your account',
      description: 'Your own name and password.',
      permission: 'dashboard.read' as const,
    },
  ].filter((screen) => can(user.permissions, screen.permission));

  const health = [
    {
      ok: revalidationConfigured(),
      label: 'Publishing reaches the website',
      detail: revalidationConfigured()
        ? `Saves are pushed to ${company?.siteUrl ?? 'the site'} straight away.`
        : 'SITE_REVALIDATE_SECRET is not set. A save is recorded, and the site picks it up on its hourly refresh rather than at once.',
    },
    {
      ok: mailConfigured(),
      label: 'Email is sent',
      detail: mailConfigured()
        ? 'Enquiries are acknowledged and the office is notified.'
        : 'RESEND_API_KEY is not set. Messages are written and recorded — you can read them on the Email screen — but nothing leaves this server.',
    },
  ];

  return (
    <>
      <PageHeader title="Settings" description={company?.name ?? 'Lotus Peak'} />

      <div className="grid gap-4 sm:grid-cols-2">
        {screens.map((screen) => {
          const Icon = screen.icon;
          return (
            <Link
              key={screen.href}
              href={screen.href}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <Icon className="size-4 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{screen.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{screen.description}</p>
            </Link>
          );
        })}
      </div>

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Is this install wired up?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Both of these fail quietly. Everything looks as though it worked.
        </p>
        <ul className="mt-4 space-y-3">
          {health.map((check) => (
            <li key={check.label} className="flex items-start gap-3">
              <span
                className={
                  check.ok
                    ? 'mt-1.5 size-2 shrink-0 rounded-full bg-status-published'
                    : 'mt-1.5 size-2 shrink-0 rounded-full bg-status-attention'
                }
                aria-hidden
              />
              <div>
                <p className="text-sm">{check.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
