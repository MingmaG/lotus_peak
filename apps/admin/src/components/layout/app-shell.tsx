'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, LogOut, Menu as MenuIcon, Moon, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { Sidebar } from './sidebar';
import { CommandPalette } from './command-palette';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { allNavItems } from '@/config/navigation';
import { apiGet } from '@/lib/api-client';

export interface AppShellUser {
  id: string;
  name: string;
  email: string;
  roleSlug: string;
  permissions: string[];
}

type Badges = Partial<Record<'enquiries' | 'notFound' | 'scheduled', number>>;

/**
 * The frame every screen sits in.
 *
 * Three layouts, one component:
 *
 * - **≥1024 px** — a fixed 260 px rail and the content beside it.
 * - **768–1023 px** — the rail becomes a sheet; the content takes the width.
 * - **<768 px** — the same sheet, and the top bar loses everything but the
 *   menu button, the title and the account.
 *
 * The breakpoint for collapsing is 1024 and not 768 on purpose: a tablet in
 * portrait is 768 wide, and a 260 px rail on it leaves 508 px for a table that
 * needs more.
 */
export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  /**
   * The counts beside Enquiries, Redirects and Departures.
   *
   * Polled rather than pushed. A websocket for three integers that change a
   * few times a day is a connection to keep alive, a reconnect to handle and a
   * server to hold state in; a minute of staleness on "how many enquiries are
   * new" costs nothing.
   */
  const { data: badges } = useQuery<Badges>({
    queryKey: ['dashboard', 'badges'],
    queryFn: () => apiGet<Badges>('/api/dashboard/badges'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  /* A navigation should close the sheet. Without this, tapping a link on a
     phone navigates behind an open drawer, which reads as nothing happening. */
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-[260px] shrink-0 border-r border-sidebar-border lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar permissions={user.permissions} badges={badges ?? {}} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open the menu"
              >
                <MenuIcon className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Sections</SheetTitle>
              <Sidebar
                permissions={user.permissions}
                badges={badges ?? {}}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
            {titleFor(pathname)}
          </h1>

          <CommandPalette permissions={user.permissions} />

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="hidden sm:inline-flex"
            title="Open the website"
          >
            <a href={siteUrl()} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              <span className="sr-only">Open the website</span>
            </a>
          </Button>

          <ThemeToggle />
          <AccountMenu user={user} />
        </header>

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  /**
   * Renders nothing until mounted.
   *
   * The theme is only knowable in the browser, and rendering a sun on the
   * server against a moon on the client is a hydration mismatch React will
   * warn about on every page load.
   */
  if (!mounted) return <div className="size-9" aria-hidden />;

  const dark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Use the light theme' : 'Use the dark theme'}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function AccountMenu({ user }: { user: AppShellUser }) {
  const router = useRouter();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Your account">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
            {initials(user.name)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            {user.roleSlug}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 size-4" />
            Your profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="sm:hidden">
          <a href={siteUrl()} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 size-4" />
            Open the website
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:6010';
}

/**
 * The title in the bar.
 *
 * Matched against the navigation rather than derived from the path, so
 * `/seo/redirects` reads "Redirects" and not "Seo / Redirects". The longest
 * matching entry wins, which is what makes a nested screen name itself.
 */
function titleFor(pathname: string): string {
  const matches = allNavItems()
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.label ?? 'Lotus Peak';
}
