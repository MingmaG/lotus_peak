'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, Star } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, Section } from '@/components/shared/editor-shell';
import { SortableList } from '@/components/shared/sortable-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPut } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Item {
  key: string;
  label: string;
  href: string;
  isExternal: boolean;
  isCta: boolean;
}

interface Menu {
  location: 'HEADER' | 'FOOTER_ONE' | 'FOOTER_TWO' | 'FOOTER_THREE' | 'LEGAL';
  name: string;
  items: Item[];
}

/**
 * `name` is the heading a menu is created with. On a footer column it is what
 * the site prints above the links, so it is editable there; the header's name
 * is never shown and is not.
 */
const LOCATIONS: {
  location: Menu['location'];
  title: string;
  name: string;
  description: string;
}[] = [
  {
    location: 'HEADER',
    title: 'Header',
    name: 'Header',
    description:
      'The navigation across the top. One link may be the call to action — the filled saffron button — and the design allows exactly one.',
  },
  {
    location: 'FOOTER_ONE',
    title: 'Footer, first column',
    name: 'Journeys',
    description: 'A column with no links is not shown. All three can be hidden at once under Company → On the site.',
  },
  {
    location: 'FOOTER_TWO',
    title: 'Footer, second column',
    name: 'Bhutan',
    description: 'A column with no links is not shown.',
  },
  {
    location: 'FOOTER_THREE',
    title: 'Footer, third column',
    name: 'Practical',
    description: 'A column with no links is not shown.',
  },
];

export function NavigationScreen({
  canWrite,
  knownPaths,
}: {
  canWrite: boolean;
  knownPaths: string[];
}) {
  const client = useQueryClient();
  const [menus, setMenus] = React.useState<Menu[] | null>(null);

  const { data, isLoading } = useQuery<{
    menus: {
      location: Menu['location'];
      name: string;
      items: { label: string; href: string; isExternal: boolean; isCta: boolean }[];
    }[];
  }>({
    queryKey: ['menus'],
    queryFn: () => apiGet('/api/menus'),
  });

  React.useEffect(() => {
    if (!data || menus) return;
    setMenus(
      LOCATIONS.map((spec) => {
        const found = data.menus.find((menu) => menu.location === spec.location);
        return {
          location: spec.location,
          name: found?.name ?? spec.name,
          items: (found?.items ?? []).map((item) => ({ ...item, key: crypto.randomUUID() })),
        };
      }),
    );
  }, [data, menus]);

  const save = useMutation({
    mutationFn: () =>
      apiPut('/api/menus', {
        menus: menus?.map((menu) => ({
          location: menu.location,
          name: menu.name.trim() || LOCATIONS.find((spec) => spec.location === menu.location)!.name,
          items: menu.items
            .filter((item) => item.label.trim() && item.href.trim())
            .map(({ key: _key, ...item }) => item),
        })),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['menus'] });
      toast.success('Saved. Every page on the site will pick this up.');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  if (isLoading || !menus) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const update = (location: Menu['location'], items: Item[]) =>
    setMenus((current) =>
      current?.map((menu) => (menu.location === location ? { ...menu, items } : menu)) ?? null,
    );

  const rename = (location: Menu['location'], name: string) =>
    setMenus((current) =>
      current?.map((menu) => (menu.location === location ? { ...menu, name } : menu)) ?? null,
    );

  return (
    <div className="max-w-3xl space-y-5">
      {LOCATIONS.map((spec) => {
        const menu = menus.find((one) => one.location === spec.location);
        if (!menu) return null;

        return (
          <Section key={spec.location} title={spec.title} description={spec.description}>
            {spec.location !== 'HEADER' && (
              <Field label="Heading">
                <Input
                  value={menu.name}
                  disabled={!canWrite}
                  onChange={(event) => rename(spec.location, event.target.value)}
                  className="max-w-xs"
                />
              </Field>
            )}
            <SortableList
              items={menu.items}
              itemKey={(item) => item.key}
              onChange={(items) => update(spec.location, items)}
              onRemove={(index) =>
                update(
                  spec.location,
                  menu.items.filter((_, i) => i !== index),
                )
              }
              onAdd={() =>
                update(spec.location, [
                  ...menu.items,
                  { key: crypto.randomUUID(), label: '', href: '', isExternal: false, isCta: false },
                ])
              }
              addLabel="Add a link"
              empty="No links here."
              disabled={!canWrite}
              describeItem={(item, index) => item.label || `link ${index + 1}`}
              renderItem={(item, index) => {
                const patch = (value: Partial<Item>) => {
                  const next = [...menu.items];
                  next[index] = { ...item, ...value };
                  update(spec.location, next);
                };

                const external = /^https?:\/\//i.test(item.href);
                const unknown =
                  !external &&
                  item.href.trim() !== '' &&
                  !item.href.startsWith('#') &&
                  !knownPaths.some((path) => item.href.split('#')[0] === path);

                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={item.label}
                      disabled={!canWrite}
                      onChange={(event) => patch({ label: event.target.value })}
                      placeholder="Our trips"
                      className="h-8 w-36 text-sm"
                      aria-label="Label"
                    />

                    <div className="min-w-40 flex-1">
                      <Input
                        value={item.href}
                        disabled={!canWrite}
                        onChange={(event) => patch({ href: event.target.value })}
                        placeholder="/trips"
                        className={cn('h-8 text-sm', unknown && 'border-status-attention')}
                        aria-label="Where it goes"
                      />
                      {unknown && (
                        /* A warning, not an error. The office links to anchors
                           and to pages that are drafts today and live tomorrow,
                           and refusing to save either would be wrong. */
                        <p className="mt-1 text-[11px] text-status-attention">
                          No published page at that address yet.
                        </p>
                      )}
                    </div>

                    {spec.location === 'HEADER' && canWrite && (
                      <Button
                        type="button"
                        variant={item.isCta ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 shrink-0 text-xs"
                        title="Make this the one filled button in the header"
                        onClick={() =>
                          update(
                            spec.location,
                            /* Exactly one. Setting it here unsets the others
                               rather than letting the save be refused. */
                            menu.items.map((other, i) => ({
                              ...other,
                              isCta: i === index ? !item.isCta : false,
                            })),
                          )
                        }
                      >
                        <Star className={cn('size-3.5', item.isCta && 'fill-current')} />
                        <span className="ml-1 hidden sm:inline">Button</span>
                      </Button>
                    )}
                  </div>
                );
              }}
            />
          </Section>
        );
      })}

      {canWrite && (
        <div className="sticky bottom-4">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="shadow-lg">
            {save.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save the navigation
          </Button>
        </div>
      )}
    </div>
  );
}

export { Plus };
