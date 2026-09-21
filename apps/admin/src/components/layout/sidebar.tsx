'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { NAVIGATION, type NavItem } from '@/config/navigation';
import { can } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SidebarProps {
  permissions: string[];
  badges: Partial<Record<'enquiries' | 'notFound' | 'scheduled', number>>;
  /** Called after a navigation, so the mobile sheet closes itself. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The navigation.
 *
 * One component for both the fixed rail at ≥1024 px and the sheet below it —
 * not two. Two drift: the version that got a new screen added to it is
 * whichever one the developer had open, and the phone is always the other one.
 */
export function Sidebar({ permissions, badges, onNavigate, className }: SidebarProps) {
  const pathname = usePathname();

  const groups = React.useMemo(
    () =>
      NAVIGATION.map((group) => ({
        ...group,
        items: group.items.filter((item) => can(permissions, item.permission)),
      })).filter((group) => group.items.length > 0),
    [permissions],
  );

  return (
    <nav
      aria-label="Sections"
      className={cn('flex h-full flex-col bg-sidebar text-sidebar-foreground', className)}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-5">
        <span className="text-[13px] font-medium uppercase tracking-[0.16em]">
          Lotus Peak
        </span>
      </div>

      {/**
       * `min-h-0` is what makes this scroll.
       *
       * A flex child defaults to `min-height: auto`, which means "at least as
       * tall as my content" — so `flex-1` alone let the scroll area grow past
       * the sidebar instead of being clipped by it, and the navigation had no
       * scrollbar of its own. The whole page scrolled instead, which on a
       * sidebar pinned with `sticky` means the lower half was unreachable.
       */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-3 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </h2>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      item={item}
                      active={isActive(pathname, item.href)}
                      count={item.badge ? badges[item.badge] : undefined}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}

function SidebarLink({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        /* 44 px of height on touch, which is the smallest target a thumb hits
           reliably; the desktop rail can afford to be tighter. */
        'group flex min-h-11 items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors md:min-h-0 md:py-1.5',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {count !== undefined && count > 0 && (
        <Badge
          variant={item.badge === 'enquiries' ? 'default' : 'secondary'}
          className="h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums"
        >
          {count > 99 ? '99+' : count}
        </Badge>
      )}
    </Link>
  );
}

/**
 * Whether this link is the one the person is on.
 *
 * `/seo` must not light up when they are on `/seo/redirects`, because both are
 * in the sidebar and two highlighted rows is two claims about where you are.
 * So: an exact match, or a prefix match where no *longer* nav entry also
 * matches.
 */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/') return false;
  if (!pathname.startsWith(`${href}/`)) return false;

  return !NAVIGATION.some(
    (group) =>
      group.items.some(
        (item) =>
          item.href.length > href.length &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`)),
      ),
  );
}
