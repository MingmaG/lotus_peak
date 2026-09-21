'use client';

import {
  Heading2,
  Image as ImageIcon,
  List,
  Plus,
  Quote,
  Table2,
  Type,
} from 'lucide-react';
import * as React from 'react';

import { RichTextEditor } from './rich-text-editor';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { SortableList, StringList } from '@/components/shared/sortable-list';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * A journal entry's body, as blocks.
 *
 * ## Why this is not a rich-text box
 *
 * Because the design renders a `facts` block as a bordered definition list in
 * the site's own type scale, and a `quote` as a Reflection. HTML from a
 * WYSIWYG toolbar renders as whatever the toolbar emitted — and the first
 * `<h1 style="color:red">` somebody pastes in from a Word document is a
 * design-system breach nobody sees until it is live.
 *
 * Blocks are also what the site's structured data and `llms-full.txt` read: a
 * `facts` block becomes a markdown table a model can lift a number out of, and
 * a blob of HTML becomes a paragraph it has to parse.
 *
 * Formatting *inside* a text block is allowed and is a restricted set — bold,
 * italic, a link, and the two list types. Enough for a sentence to carry a
 * link; not enough to break the design out of the block.
 */

export type EditorBlock =
  | { key: string; kind: 'text'; body: string }
  | { key: string; kind: 'heading'; text: string }
  | { key: string; kind: 'list'; items: string[]; ordered: boolean }
  | { key: string; kind: 'quote'; text: string; attribution: string | null }
  | { key: string; kind: 'image'; media: PickedMedia | null; ratio: string | null }
  | { key: string; kind: 'facts'; title: string; rows: [string, string][] };

const KINDS = [
  { kind: 'text', label: 'Paragraph', icon: Type, hint: 'Prose, with links and emphasis.' },
  { kind: 'heading', label: 'Heading', icon: Heading2, hint: 'Breaks a long entry up.' },
  { kind: 'list', label: 'List', icon: List, hint: 'Bulleted or numbered.' },
  { kind: 'quote', label: 'Quote', icon: Quote, hint: 'Set apart, in the design’s own type.' },
  { kind: 'image', label: 'Photograph', icon: ImageIcon, hint: 'With its caption underneath.' },
  {
    kind: 'facts',
    label: 'Facts',
    icon: Table2,
    hint: 'A table of labels and values. Read by search engines and assistants as well as by people.',
  },
] as const;

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
}) {
  const patch = (index: number, value: Partial<EditorBlock>) => {
    const next = [...blocks];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...value } as EditorBlock;
    onChange(next);
  };

  const add = (kind: EditorBlock['kind']) => {
    const key = crypto.randomUUID();
    const created: EditorBlock =
      kind === 'text'
        ? { key, kind: 'text', body: '' }
        : kind === 'heading'
          ? { key, kind: 'heading', text: '' }
          : kind === 'list'
            ? { key, kind: 'list', items: [''], ordered: false }
            : kind === 'quote'
              ? { key, kind: 'quote', text: '', attribution: null }
              : kind === 'image'
                ? { key, kind: 'image', media: null, ratio: null }
                : { key, kind: 'facts', title: '', rows: [['', '']] };
    onChange([...blocks, created]);
  };

  return (
    <div className="space-y-3">
      <SortableList
        items={blocks}
        itemKey={(block) => block.key}
        onChange={onChange}
        onRemove={(index) => onChange(blocks.filter((_, i) => i !== index))}
        empty="Nothing written yet. Add a paragraph to start."
        describeItem={(block, index) => `${block.kind} block ${index + 1}`}
        renderItem={(block, index) => (
          <div className="space-y-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {KINDS.find((item) => item.kind === block.kind)?.label ?? block.kind}
            </span>

            {block.kind === 'text' && (
              <RichTextEditor
                value={block.body}
                onChange={(body) => patch(index, { body })}
                placeholder="Write…"
              />
            )}

            {block.kind === 'heading' && (
              <Input
                value={block.text}
                onChange={(event) => patch(index, { text: event.target.value })}
                placeholder="A heading"
                className="text-base font-medium"
              />
            )}

            {block.kind === 'list' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={block.ordered}
                    onCheckedChange={(checked) => patch(index, { ordered: checked === true })}
                  />
                  Numbered
                </label>
                <StringList
                  items={block.items}
                  onChange={(items) => patch(index, { items })}
                  placeholder="A line"
                  addLabel="Add a line"
                />
              </div>
            )}

            {block.kind === 'quote' && (
              <div className="space-y-2">
                <RichTextEditor
                  value={block.text}
                  onChange={(text) => patch(index, { text })}
                  placeholder="The quotation"
                  compact
                  minHeight="min-h-[90px]"
                />
                <Input
                  value={block.attribution ?? ''}
                  onChange={(event) =>
                    patch(index, { attribution: event.target.value || null })
                  }
                  placeholder="Who said it (optional)"
                  className="h-8 text-xs"
                />
              </div>
            )}

            {block.kind === 'image' && (
              <MediaPicker
                label="Photograph"
                description="Its description becomes the caption printed underneath, so it is worth writing well."
                value={block.media}
                onChange={(media) => patch(index, { media })}
              />
            )}

            {block.kind === 'facts' && (
              <div className="space-y-2">
                <Input
                  value={block.title}
                  onChange={(event) => patch(index, { title: event.target.value })}
                  placeholder="What the table is about"
                  className="h-8 text-sm"
                />
                <div className="space-y-1.5">
                  {block.rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-2">
                      <Input
                        value={row[0]}
                        onChange={(event) => {
                          const rows = [...block.rows];
                          rows[rowIndex] = [event.target.value, row[1]];
                          patch(index, { rows });
                        }}
                        placeholder="Label"
                        className="h-8 w-32 text-xs"
                      />
                      <Input
                        value={row[1]}
                        onChange={(event) => {
                          const rows = [...block.rows];
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
                        aria-label={`Remove the ${row[0] || 'empty'} row`}
                        onClick={() =>
                          patch(index, {
                            rows: block.rows.filter((_, i) => i !== rowIndex),
                          })
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
                    onClick={() => patch(index, { rows: [...block.rows, ['', '']] })}
                  >
                    <Plus className="mr-1 size-3" />
                    Add a row
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-1.5 size-3.5" />
            Add a block
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
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
