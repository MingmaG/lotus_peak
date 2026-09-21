'use client';

import {
  AlignLeft,
  HelpCircle,
  Image as ImageIcon,
  Images,
  ListChecks,
  MessageSquareQuote,
  Mountain,
  Plus,
  Table2,
  UserSquare,
  Megaphone,
} from 'lucide-react';
import * as React from 'react';

import { IconSelect } from './icon-select';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { MediaMultiPicker, MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field } from '@/components/shared/editor-shell';
import { SortableList } from '@/components/shared/sortable-list';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * The bands an editorial page is made of.
 *
 * A closed vocabulary of ten, not a free block builder. The design composes
 * About, Terms and Travellers' information from a fixed set of bands, and an
 * editor who can invent an eleventh is an editor who can build a page the
 * design has no styles for — which nobody discovers until it is published and
 * looks wrong in a way nobody can name.
 *
 * Three of the ten reference other content rather than carrying their own: a
 * `trips` band names journeys, `reflections` names quotes, `people` names
 * guides. Each of them treats an empty list as "whatever is published, in its
 * own order", which is what the site already does and what most pages want.
 */

export type PageSection =
  | {
      key: string
      kind: 'prose'
      eyebrow: string | null
      title: string | null
      body: string
      anchor: string | null
    }
  | {
      key: string;
      kind: 'points';
      eyebrow: string | null;
      title: string | null;
      lead: string | null;
      points: { title: string; body: string; icon: string | null }[];
    }
  | { key: string; kind: 'facts'; title: string | null; rows: [string, string][] }
  | {
      key: string;
      kind: 'faq';
      title: string | null;
      items: { question: string; answer: string }[];
    }
  | {
      key: string;
      kind: 'figure';
      media: PickedMedia | null;
      caption: string | null;
      width: 'full' | 'inset';
    }
  | {
      key: string;
      kind: 'gallery';
      title: string | null;
      items: { media: PickedMedia; ratio: string | null; width: string | null }[];
    }
  | { key: string; kind: 'reflections'; title: string | null; reflectionIds: string[] }
  | { key: string; kind: 'trips'; title: string | null; lead: string | null; tripSlugs: string[] }
  | {
      key: string;
      kind: 'cta';
      title: string;
      lead: string | null;
      label: string;
      href: string;
      band: boolean;
    }
  | { key: string; kind: 'people'; title: string | null; lead: string | null; personIds: string[] };

const KINDS = [
  { kind: 'prose', label: 'Prose', icon: AlignLeft, hint: 'A heading and some paragraphs.' },
  {
    kind: 'points',
    label: 'Points',
    icon: ListChecks,
    hint: 'Two to four short pieces side by side, each with its own heading.',
  },
  {
    kind: 'facts',
    label: 'Facts',
    icon: Table2,
    hint: 'A table of labels and values. Read by search engines as well as by people.',
  },
  { kind: 'faq', label: 'Questions', icon: HelpCircle, hint: 'An expandable list.' },
  { kind: 'figure', label: 'A photograph', icon: ImageIcon, hint: 'One picture, inset or full-bleed.' },
  { kind: 'gallery', label: 'Several photographs', icon: Images, hint: 'A strip, in mixed shapes.' },
  {
    kind: 'reflections',
    label: 'Reflections',
    icon: MessageSquareQuote,
    hint: 'What travellers have said. Empty shows the featured ones.',
  },
  {
    kind: 'trips',
    label: 'Journeys',
    icon: Mountain,
    hint: 'A row of journey cards. Empty shows the catalogue in its own order.',
  },
  { kind: 'people', label: 'People', icon: UserSquare, hint: 'The guides. Empty shows everybody.' },
  {
    kind: 'cta',
    label: 'Call to action',
    icon: Megaphone,
    hint: 'A closing band with one button. The design allows one filled button per section.',
  },
] as const;

export function SectionEditor({
  sections,
  onChange,
  trips,
  reflections,
  people,
}: {
  sections: PageSection[];
  onChange: (sections: PageSection[]) => void;
  trips: { slug: string; title: string }[];
  reflections: { id: string; name: string; quote: string }[];
  people: { id: string; name: string }[];
}) {
  const patch = (index: number, value: Partial<PageSection>) => {
    const next = [...sections];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...value } as PageSection;
    onChange(next);
  };

  const add = (kind: PageSection['kind']) => {
    const key = crypto.randomUUID();
    const created: Record<PageSection['kind'], PageSection> = {
      prose: { key, kind: 'prose', eyebrow: null, title: null, body: '', anchor: null },
      points: { key, kind: 'points', eyebrow: null, title: null, lead: null, points: [{ title: '', body: '', icon: null }] },
      facts: { key, kind: 'facts', title: null, rows: [['', '']] },
      faq: { key, kind: 'faq', title: null, items: [{ question: '', answer: '' }] },
      figure: { key, kind: 'figure', media: null, caption: null, width: 'inset' },
      gallery: { key, kind: 'gallery', title: null, items: [] },
      reflections: { key, kind: 'reflections', title: null, reflectionIds: [] },
      trips: { key, kind: 'trips', title: null, lead: null, tripSlugs: [] },
      people: { key, kind: 'people', title: null, lead: null, personIds: [] },
      cta: { key, kind: 'cta', title: '', lead: null, label: '', href: '/contact', band: true },
    };
    onChange([...sections, created[kind]]);
  };

  return (
    <div className="space-y-3">
      <SortableList
        items={sections}
        itemKey={(section) => section.key}
        onChange={onChange}
        onRemove={(index) => onChange(sections.filter((_, i) => i !== index))}
        empty="No bands yet. A page needs at least one."
        describeItem={(section, index) =>
          `${KINDS.find((one) => one.kind === section.kind)?.label ?? section.kind} band ${index + 1}`
        }
        renderItem={(section, index) => (
          <div className="space-y-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {KINDS.find((one) => one.kind === section.kind)?.label ?? section.kind}
            </span>

            {section.kind === 'prose' && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={section.eyebrow ?? ''}
                    onChange={(event) => patch(index, { eyebrow: event.target.value || null })}
                    placeholder="Eyebrow (optional)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={section.title ?? ''}
                    onChange={(event) => patch(index, { title: event.target.value || null })}
                    placeholder="Heading (optional)"
                    className="h-8 text-sm"
                  />
                </div>
                <RichTextEditor
                  value={section.body}
                  onChange={(body) => patch(index, { body })}
                  placeholder="Write…"
                />
                <Field
                  label="Link to this band"
                  hint="The fragment somebody can link to: /terms#cancellation. Leave it empty and one is made from the heading — but once somebody has linked to it, changing the heading would break the link, and setting it here stops that."
                >
                  <Input
                    value={section.anchor ?? ''}
                    onChange={(event) =>
                      patch(index, { anchor: event.target.value.trim() || null })
                    }
                    placeholder="cancellation"
                    className="h-8 text-xs"
                  />
                </Field>
              </>
            )}

            {section.kind === 'points' && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={section.eyebrow ?? ''}
                    onChange={(event) => patch(index, { eyebrow: event.target.value || null })}
                    placeholder="Eyebrow"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={section.title ?? ''}
                    onChange={(event) => patch(index, { title: event.target.value || null })}
                    placeholder="Heading"
                    className="h-8 text-sm"
                  />
                </div>
                <Textarea
                  value={section.lead ?? ''}
                  onChange={(event) => patch(index, { lead: event.target.value || null })}
                  placeholder="A sentence under the heading (optional)"
                  rows={2}
                  className="text-sm"
                />

                <div className="space-y-2">
                  {section.points.map((point, pointIndex) => (
                    <div key={pointIndex} className="space-y-1.5 rounded border p-2">
                      <div className="flex gap-2">
                        <Input
                          value={point.title}
                          onChange={(event) => {
                            const points = [...section.points];
                            points[pointIndex] = { ...point, title: event.target.value };
                            patch(index, { points });
                          }}
                          placeholder="Heading"
                          className="h-8 flex-1 text-sm"
                        />
                        <div className="w-36">
                          <IconSelect
                            value={point.icon ?? 'DZONG'}
                            onChange={(icon) => {
                              const points = [...section.points];
                              points[pointIndex] = { ...point, icon };
                              patch(index, { points });
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Remove ${point.title || 'this point'}`}
                          onClick={() =>
                            patch(index, {
                              points: section.points.filter((_, i) => i !== pointIndex),
                            })
                          }
                        >
                          ×
                        </Button>
                      </div>
                      <Textarea
                        value={point.body}
                        onChange={(event) => {
                          const points = [...section.points];
                          points[pointIndex] = { ...point, body: event.target.value };
                          patch(index, { points });
                        }}
                        rows={2}
                        placeholder="A sentence or two."
                        className="text-sm"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      patch(index, {
                        points: [...section.points, { title: '', body: '', icon: null }],
                      })
                    }
                  >
                    <Plus className="mr-1 size-3" />
                    Add a point
                  </Button>
                </div>
              </>
            )}

            {section.kind === 'facts' && (
              <>
                <Input
                  value={section.title ?? ''}
                  onChange={(event) => patch(index, { title: event.target.value || null })}
                  placeholder="What the table is about"
                  className="h-8 text-sm"
                />
                {section.rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex gap-2">
                    <Input
                      value={row[0]}
                      onChange={(event) => {
                        const rows = [...section.rows];
                        rows[rowIndex] = [event.target.value, row[1]];
                        patch(index, { rows });
                      }}
                      placeholder="Label"
                      className="h-8 w-32 text-xs"
                    />
                    <Input
                      value={row[1]}
                      onChange={(event) => {
                        const rows = [...section.rows];
                        rows[rowIndex] = [row[0], event.target.value];
                        patch(index, { rows });
                      }}
                      placeholder="Value"
                      className="h-8 flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Remove this row"
                      onClick={() =>
                        patch(index, { rows: section.rows.filter((_, i) => i !== rowIndex) })
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => patch(index, { rows: [...section.rows, ['', '']] })}
                >
                  <Plus className="mr-1 size-3" />
                  Add a row
                </Button>
              </>
            )}

            {section.kind === 'faq' && (
              <>
                <Input
                  value={section.title ?? ''}
                  onChange={(event) => patch(index, { title: event.target.value || null })}
                  placeholder="Heading"
                  className="h-8 text-sm"
                />
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="space-y-1.5 rounded border p-2">
                    <div className="flex gap-2">
                      <Input
                        value={item.question}
                        onChange={(event) => {
                          const items = [...section.items];
                          items[itemIndex] = { ...item, question: event.target.value };
                          patch(index, { items });
                        }}
                        placeholder="The question, as somebody would ask it"
                        className="h-8 flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label="Remove this question"
                        onClick={() =>
                          patch(index, { items: section.items.filter((_, i) => i !== itemIndex) })
                        }
                      >
                        ×
                      </Button>
                    </div>
                    <Textarea
                      value={item.answer}
                      onChange={(event) => {
                        const items = [...section.items];
                        items[itemIndex] = { ...item, answer: event.target.value };
                        patch(index, { items });
                      }}
                      rows={2}
                      placeholder="The answer."
                      className="text-sm"
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    patch(index, { items: [...section.items, { question: '', answer: '' }] })
                  }
                >
                  <Plus className="mr-1 size-3" />
                  Add a question
                </Button>
              </>
            )}

            {section.kind === 'figure' && (
              <>
                <MediaPicker
                  value={section.media}
                  onChange={(media) => patch(index, { media })}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={section.caption ?? ''}
                    onChange={(event) => patch(index, { caption: event.target.value || null })}
                    placeholder="Caption (optional)"
                    className="h-8 text-xs"
                  />
                  <Select
                    value={section.width}
                    onValueChange={(width) => patch(index, { width: width as 'full' | 'inset' })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inset">Within the text</SelectItem>
                      <SelectItem value="full">Full width</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {section.kind === 'gallery' && (
              <>
                <Input
                  value={section.title ?? ''}
                  onChange={(event) => patch(index, { title: event.target.value || null })}
                  placeholder="Heading (optional)"
                  className="h-8 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {section.items.map((item, itemIndex) => (
                    <button
                      key={item.media.id}
                      type="button"
                      onClick={() =>
                        patch(index, {
                          items: section.items.filter((_, i) => i !== itemIndex),
                        })
                      }
                      className="group relative"
                      aria-label={`Remove ${item.media.alt || 'this photograph'}`}
                    >
                      <img
                        src={item.media.url}
                        alt=""
                        className="size-16 rounded object-cover group-hover:opacity-50"
                      />
                      <span className="absolute inset-0 hidden items-center justify-center text-lg group-hover:flex">
                        ×
                      </span>
                    </button>
                  ))}
                </div>
                <MediaMultiPicker
                  onPick={(media) =>
                    patch(index, {
                      items: [
                        ...section.items,
                        ...media
                          .filter((one) => !section.items.some((item) => item.media.id === one.id))
                          .map((one) => ({ media: one, ratio: null, width: null })),
                      ],
                    })
                  }
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                      <Plus className="mr-1 size-3" />
                      Add photographs
                    </Button>
                  }
                />
              </>
            )}

            {section.kind === 'reflections' && (
              <>
                <Input
                  value={section.title ?? ''}
                  onChange={(event) => patch(index, { title: event.target.value || null })}
                  placeholder="Heading (optional)"
                  className="h-8 text-sm"
                />
                <Picker
                  hint="Leave everything unticked to show the featured reflections, which is what most pages want."
                  options={reflections.map((row) => ({
                    value: row.id,
                    label: `${row.name} — “${row.quote.slice(0, 50)}…”`,
                  }))}
                  selected={section.reflectionIds}
                  onChange={(reflectionIds) => patch(index, { reflectionIds })}
                />
              </>
            )}

            {section.kind === 'trips' && (
              <>
                <Input
                  value={section.title ?? ''}
                  onChange={(event) => patch(index, { title: event.target.value || null })}
                  placeholder="Heading (optional)"
                  className="h-8 text-sm"
                />
                <Textarea
                  value={section.lead ?? ''}
                  onChange={(event) => patch(index, { lead: event.target.value || null })}
                  rows={2}
                  placeholder="A sentence under it (optional)"
                  className="text-sm"
                />
                <Picker
                  hint="Leave everything unticked to show the catalogue in its own order — which is right unless this page has just argued for three particular journeys."
                  options={trips.map((trip) => ({ value: trip.slug, label: trip.title }))}
                  selected={section.tripSlugs}
                  onChange={(tripSlugs) => patch(index, { tripSlugs })}
                />
              </>
            )}

            {section.kind === 'people' && (
              <>
                <Input
                  value={section.title ?? ''}
                  onChange={(event) => patch(index, { title: event.target.value || null })}
                  placeholder="Heading (optional)"
                  className="h-8 text-sm"
                />
                <Picker
                  hint="Leave everything unticked to show everybody, in the order the People screen puts them."
                  options={people.map((person) => ({ value: person.id, label: person.name }))}
                  selected={section.personIds}
                  onChange={(personIds) => patch(index, { personIds })}
                />
              </>
            )}

            {section.kind === 'cta' && (
              <>
                <Input
                  value={section.title}
                  onChange={(event) => patch(index, { title: event.target.value })}
                  placeholder="Come and see"
                  className="h-8 text-sm"
                />
                <Textarea
                  value={section.lead ?? ''}
                  onChange={(event) => patch(index, { lead: event.target.value || null })}
                  rows={2}
                  placeholder="A sentence."
                  className="text-sm"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={section.label}
                    onChange={(event) => patch(index, { label: event.target.value })}
                    placeholder="Make an enquiry"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={section.href}
                    onChange={(event) => patch(index, { href: event.target.value })}
                    placeholder="/contact"
                    className="h-8 text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={section.band}
                    onCheckedChange={(checked) => patch(index, { band: checked === true })}
                  />
                  Draw it on the dark band
                </label>
              </>
            )}
          </div>
        )}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-1.5 size-3.5" />
            Add a band
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          {KINDS.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.kind}
                onClick={() => add(item.kind)}
                className="flex-col items-start gap-0.5 py-2"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Icon className="size-3.5" />
                  {item.label}
                </span>
                <span className="pl-5.5 text-xs text-muted-foreground">{item.hint}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Choosing some of a list, or none of it.
 *
 * "None" is a meaningful answer in every band that uses this — it means the
 * published set in its own order — so the empty state says so rather than
 * looking like an unfinished form.
 */
function Picker({
  options,
  selected,
  onChange,
  hint,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  hint: string;
}) {
  return (
    <Field label={selected.length === 0 ? 'Showing everything' : `Showing ${selected.length}`} hint={hint}>
      <div className="max-h-48 space-y-1.5 overflow-y-auto rounded border p-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...selected, option.value]
                    : selected.filter((value) => value !== option.value),
                )
              }
            />
            <span className="min-w-0 flex-1">{option.label}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}
