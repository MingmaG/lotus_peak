'use client';

import { mergeAttributes, Node, type CommandProps } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { ImageOff, Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * A photograph inside a body, with the four things a photograph needs.
 *
 * ## Why this replaces `@tiptap/extension-image`
 *
 * That extension stores an `<img>` and nothing else: one `src`, one `alt`, and
 * no way to write a caption. Three consequences, all of which the office ran
 * into:
 *
 * 1. **A photograph could not be described where it was used.** The library's
 *    description is one sentence for one file, and the same picture of
 *    Taktsang is "the monastery from the tea house" in one entry and "the last
 *    of the climb" in another. Alt text is context, and the context is here.
 * 2. **There was no caption.** A caption is read by everybody; alt text is read
 *    by the people who cannot see the picture and by a crawler. They are
 *    different sentences with different jobs, and a field that serves both
 *    serves neither.
 * 3. **It could not be deleted.** An `<img>` dropped into the document with no
 *    node view is selectable in principle, but nothing on the screen says so —
 *    no outline when it is selected, no gap cursor to put the caret after it.
 *    Backspace appeared to do nothing, which is the bug that started this.
 *
 * ## What it stores, and what is derived
 *
 * ```
 *   <figure data-media-id="clx…" data-alt="…" data-caption="…"
 *           data-credit="…" data-title="…" data-ratio="3/2">
 *     <img src="…" alt="…" title="…">
 *     <figcaption>…</figcaption>
 *   </figure>
 * ```
 *
 * Everything the writer typed is a `data-` attribute on the `<figure>`. The
 * `<img>` and the `<figcaption>` are **derived** — written out so that the
 * stored document is legible on its own, stripped before the column is written
 * and rebuilt on the way out (`server/schema/rich-text.ts`), and rebuilt again
 * from the attributes by the website's sanitiser. That is what lets a
 * photograph be re-cropped, re-described or moved to a CDN without an UPDATE
 * over every body that used it.
 *
 * An `<img>` with no media id — a body written before this existed — parses
 * into the same node with `mediaId: null`, keeps its `src`, and is never
 * rewritten. It is somebody's writing; losing the photograph out of it to
 * tidy the data model would not be an improvement.
 */

export interface FigureAttrs {
  mediaId: string | null;
  src: string | null;
  /** The description, for a reader who cannot see it. `''` means decorative. */
  alt: string;
  /** The line printed underneath, which everybody reads. */
  caption: string;
  /** Whose photograph it is. Printed after the caption. */
  credit: string;
  /** The `title` attribute — the hover line, and a hint to a crawler. */
  title: string;
  ratio: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      setFigure: (attrs: Partial<FigureAttrs>) => ReturnType;
    };
  }
}

function dataAttr(element: HTMLElement, name: string): string {
  return element.getAttribute(`data-${name}`) ?? '';
}

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  /* Atom: it has no editable content of its own — the caption is a field in
     the node view, not a text node — so the caret can never get stuck inside
     it, and Backspace on a selected one deletes the whole figure. */
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      mediaId: { default: null, parseHTML: (el) => el.getAttribute('data-media-id') },
      src: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      credit: { default: '' },
      title: { default: '' },
      ratio: { default: null, parseHTML: (el) => el.getAttribute('data-ratio') },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        /* Higher than the bare-`img` rule below, so a figure is taken whole
           rather than descended into and read as a loose image. */
        priority: 60,
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          /* A film is a different node with its own rule; leave it alone. */
          if (element.hasAttribute('data-video')) return false;

          const img = element.querySelector('img');
          const caption = element.querySelector('figcaption');

          return {
            mediaId: element.getAttribute('data-media-id'),
            src: img?.getAttribute('src') ?? null,
            /* `data-alt` wins, including when it is deliberately empty; the
               `<img>` is only consulted for a figure that never had one. */
            alt: element.hasAttribute('data-alt')
              ? dataAttr(element, 'alt')
              : (img?.getAttribute('alt') ?? ''),
            caption: element.hasAttribute('data-caption')
              ? dataAttr(element, 'caption')
              : (caption?.textContent?.trim() ?? ''),
            credit: dataAttr(element, 'credit'),
            title: element.hasAttribute('data-title')
              ? dataAttr(element, 'title')
              : (img?.getAttribute('title') ?? ''),
            ratio: element.getAttribute('data-ratio'),
          };
        },
      },
      {
        /* A loose `<img>`, which is what every body written before this holds. */
        tag: 'img[src]',
        priority: 40,
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          return {
            mediaId: element.getAttribute('data-media-id'),
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt') ?? '',
            caption: '',
            credit: '',
            title: element.getAttribute('title') ?? '',
            ratio: null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as FigureAttrs;

    const figure = mergeAttributes(
      {
        ...(attrs.mediaId ? { 'data-media-id': attrs.mediaId } : {}),
        ...(attrs.ratio ? { 'data-ratio': attrs.ratio } : {}),
        'data-alt': attrs.alt,
        ...(attrs.caption ? { 'data-caption': attrs.caption } : {}),
        ...(attrs.credit ? { 'data-credit': attrs.credit } : {}),
        ...(attrs.title ? { 'data-title': attrs.title } : {}),
      },
      /* `HTMLAttributes` carries the raw attribute names too; the ones that
         belong on the `<img>` are written there instead, so they are dropped
         here rather than duplicated onto the figure. */
      omit(HTMLAttributes, ['mediaId', 'src', 'alt', 'caption', 'credit', 'title', 'ratio']),
    );

    const image: [string, Record<string, string>] = [
      'img',
      {
        ...(attrs.src ? { src: attrs.src } : {}),
        alt: attrs.alt,
        ...(attrs.title ? { title: attrs.title } : {}),
      },
    ];

    const line = [attrs.caption, attrs.credit].filter(Boolean).join(' — ');

    return line
      ? ['figure', figure, image, ['figcaption', {}, line]]
      : ['figure', figure, image];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },

  addCommands() {
    return {
      setFigure:
        (attrs: Partial<FigureAttrs>) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  addKeyboardShortcuts() {
    return {
      /* Enter on a selected figure opens a paragraph after it rather than
         replacing the photograph with an empty line, which is what the default
         does to a selected atom and is never what somebody meant. */
      Enter: () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
          return false;
        }
        return this.editor
          .chain()
          .insertContentAt(selection.to, { type: 'paragraph' })
          .focus()
          .run();
      },
    };
  },
});

function omit(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!keys.includes(key)) out[key] = value;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  The node view                                                              */
/* -------------------------------------------------------------------------- */

function FigureView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const attrs = node.attrs as FigureAttrs;
  const [open, setOpen] = React.useState(false);

  const described = attrs.alt.trim() !== '';
  const line = [attrs.caption, attrs.credit].filter(Boolean).join(' — ');

  return (
    <NodeViewWrapper
      as="figure"
      className={cn(
        'lp-figure group relative my-4 rounded-lg border bg-muted/20 p-2 transition-shadow',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
      data-drag-handle
    >
      {attrs.src ? (
        /* The library's own URL at its own size. `next/image` would optimise
           a thumbnail that is already a thumbnail, inside a text box. */
        <img
          src={attrs.src}
          alt={attrs.alt}
          title={attrs.title || undefined}
          className="block h-auto w-full rounded-md"
          draggable={false}
        />
      ) : (
        <div className="flex h-32 items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
          <ImageOff className="size-4" />
          That photograph is no longer in the library.
        </div>
      )}

      {editor.isEditable && (
        <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 shadow-sm"
            onClick={() => setOpen(true)}
          >
            <Pencil className="mr-1 size-3" />
            Describe
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="size-7 shadow-sm"
            aria-label="Remove this photograph"
            onClick={() => deleteNode()}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}

      <figcaption
        className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground"
        contentEditable={false}
      >
        {line || <span className="italic opacity-60">No caption</span>}
        {!described && (
          /* The one thing on this component that is a warning rather than a
             label. An undescribed photograph is invisible to a screen reader
             and to a crawler, and it is invisible in the editor too unless
             something says so here. */
          <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            No description
          </span>
        )}
      </figcaption>

      <FigureDialog
        open={open}
        onOpenChange={setOpen}
        attrs={attrs}
        onSave={(next) => updateAttributes(next)}
      />
    </NodeViewWrapper>
  );
}

export function FigureDialog({
  open,
  onOpenChange,
  attrs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attrs: Pick<FigureAttrs, 'alt' | 'caption' | 'credit' | 'title'>;
  onSave: (next: Pick<FigureAttrs, 'alt' | 'caption' | 'credit' | 'title'>) => void;
}) {
  const [alt, setAlt] = React.useState(attrs.alt);
  const [caption, setCaption] = React.useState(attrs.caption);
  const [credit, setCredit] = React.useState(attrs.credit);
  const [title, setTitle] = React.useState(attrs.title);

  React.useEffect(() => {
    if (!open) return;
    setAlt(attrs.alt);
    setCaption(attrs.caption);
    setCredit(attrs.credit);
    setTitle(attrs.title);
  }, [open, attrs.alt, attrs.caption, attrs.credit, attrs.title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>This photograph, here</DialogTitle>
          <DialogDescription>
            Four different sentences with four different jobs. The library holds one
            description per file; this is what the photograph means in <em>this</em> entry,
            and it is what a search engine and a screen reader read.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="figure-alt">Description (alt text)</Label>
            <Textarea
              id="figure-alt"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              rows={2}
              placeholder="Monks crossing the courtyard at Punakha before the morning session"
            />
            <p className="text-xs text-muted-foreground">
              What somebody who cannot see it would need told. Leave it empty only if the
              photograph is decoration and says nothing the words do not.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="figure-caption">Caption</Label>
            <Textarea
              id="figure-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={2}
              placeholder="Punakha Dzong, at the confluence of the Pho Chhu and the Mo Chhu"
            />
            <p className="text-xs text-muted-foreground">
              Printed underneath, for everybody. Often the more interesting sentence — the
              description says what is in the frame, the caption says why it is here.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="figure-credit">Credit</Label>
              <Input
                id="figure-credit"
                value={credit}
                onChange={(event) => setCredit(event.target.value)}
                placeholder="Photograph: Karma Wangchuk"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="figure-title">Title</Label>
              <Input
                id="figure-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Punakha Dzong"
              />
              <p className="text-xs text-muted-foreground">Shown on hover. Optional.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave({ alt: alt.trim(), caption: caption.trim(), credit: credit.trim(), title: title.trim() });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
