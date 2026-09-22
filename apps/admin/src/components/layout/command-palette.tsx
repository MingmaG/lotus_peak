'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { NAVIGATION } from '@/config/navigation';
import { can } from '@/lib/auth/permissions';

/**
 * ⌘K.
 *
 * Only the screens, for now — not a search across content. A palette that
 * searches rows needs a server round trip per keystroke and an index to make
 * it fast, and the thing this office actually does forty times a day is move
 * between screens.
 */
export function CommandPalette({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(permissions, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-8 gap-2 px-2.5 text-muted-foreground md:inline-flex"
      >
        <Search className="size-3.5" />
        <span className="text-xs">Go to…</span>
        <kbd className="ml-1 rounded border bg-muted px-1 text-[10px]">⌘K</kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="md:hidden"
        aria-label="Go to a screen"
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Go to…" />
        <CommandList>
          <CommandEmpty>Nothing by that name.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.hint ?? ''}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <Icon className="mr-2 size-4" />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
