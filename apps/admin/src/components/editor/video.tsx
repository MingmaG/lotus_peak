'use client';

import { mergeAttributes, Node, type CommandProps } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { Film, Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';

import { parseVideoSource, providerLabel, thumbnailUrl, watchUrl } from '@lotuspeak/video';

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
 * A film inside a body, with a caption and a title.
 *
 * ## Why this replaces `@tiptap/extension-youtube`
 *
 * That extension stores an `<iframe>`. Three problems with that, in order of
 * how much they cost:
 *
 * 1. **An iframe in the column is a player on the page.** The website already
 *    refused to render it and rebuilt it as a façade — a still, a play button,
 *    a real link — because three films on one entry is something like a
 *    megabyte and a half of third-party JavaScript on a page somebody came to
 *    read. Storing the embed and throwing it away on every render is storing
 *    the wrong thing.
 * 2. **It could not be captioned or titled.** A film needs a line saying what
 *    it is, for the same reason a photograph does — and the accessible name of
 *    the link to it should be that line, not "Watch the film".
 * 3. **It could not be deleted.** Same as the photograph: no node view, no
 *    outline when selected, nothing to tell somebody the caret is on it.
 *
 * What is stored is the canonical *watch* URL — `youtube.com/watch?v=…`, not
 * an embed URL — because that is the durable address of the film, and because
 * it is what the façade's link has to point at anyway for somebody who would
 * rather open it on YouTube.
 *
 * ```
 *   <figure data-video="https://www.youtube.com/watch?v=…"
 *           data-title="…" data-caption="…"></figure>
 * ```
 *
 * An old `<div data-youtube-video><iframe …></div>` parses into this node, so
 * a body written before today upgrades the first time it is opened.
 */

export interface VideoAttrs {
  src: string | null;
  /** The film's name. Becomes the link's accessible name on the website. */
  title: string;
  /** The line printed underneath. */
  caption: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoFigure: {
      setVideoFigure: (attrs: Partial<VideoAttrs>) => ReturnType;
    };
  }
}

/** The watch URL for whatever somebody pasted, or null if it names no film. */
export function canonicalVideoUrl(url: string | null | undefined): string | null {
  return watchUrl(parseVideoSource(url ?? ''));
}

export const VideoFigure = Node.create({
  name: 'videoFigure',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      src: { default: null, parseHTML: (el) => el.getAttribute('data-video') },
      title: { default: '', parseHTML: (el) => el.getAttribute('data-title') ?? '' },
      caption: { default: '', parseHTML: (el) => el.getAttribute('data-caption') ?? '' },
    };
  },

  parseHTML() {
    return [
      { tag: 'figure[data-video]', priority: 70 },
      {
        /* What the YouTube extension wrote, and a bare iframe pasted from an
           embed code. Both carry an embed URL; `canonicalVideoUrl` turns it
           back into the watch URL this node stores. */
        tag: 'iframe[src]',
        priority: 50,
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const src = canonicalVideoUrl(element.getAttribute('src'));
          /* An iframe pointing at something that is not a film is not a film.
             Returning false drops it, which is the safe direction. */
          if (!src) return false;
          return { src, title: element.getAttribute('title') ?? '', caption: '' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as VideoAttrs;
    const line = attrs.caption.trim();

    const figure = mergeAttributes(
      {
        ...(attrs.src ? { 'data-video': attrs.src } : {}),
        ...(attrs.title ? { 'data-title': attrs.title } : {}),
        ...(line ? { 'data-caption': line } : {}),
      },
      omit(HTMLAttributes, ['src', 'title', 'caption']),
    );

    /* A link rather than an empty element, so the stored document is something
       a person can follow if they ever read it outside this editor. The
       website rebuilds the façade from the attributes and ignores this. */
    const link: [string, Record<string, string>, string] = [
      'a',
      { href: attrs.src ?? '#' },
      attrs.title || attrs.src || 'Film',
    ];

    return line ? ['figure', figure, link, ['figcaption', {}, line]] : ['figure', figure, link];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },

  addCommands() {
    return {
      setVideoFigure:
        (attrs: Partial<VideoAttrs>) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name, attrs }),
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

function VideoView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const attrs = node.attrs as VideoAttrs;
  const [open, setOpen] = React.useState(false);

  const source = React.useMemo(() => parseVideoSource(attrs.src ?? ''), [attrs.src]);
  const still = thumbnailUrl(source);

  return (
    <NodeViewWrapper
      as="figure"
      className={cn(
        'lp-video-figure group relative my-4 rounded-lg border bg-muted/20 p-2',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
      data-drag-handle
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-foreground/90">
        {still && (
          /* A still from YouTube's own CDN, at one fixed size. */
          <img
            src={still}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-80"
            draggable={false}
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-background">
          <Film className="size-8 drop-shadow" />
          <span className="rounded bg-black/55 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
            {providerLabel(source)}
          </span>
        </div>
      </div>

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
            aria-label="Remove this film"
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
        {attrs.caption || attrs.title || (
          <span className="italic opacity-60">No caption</span>
        )}
      </figcaption>

      <VideoDialog
        open={open}
        onOpenChange={setOpen}
        attrs={attrs}
        onSave={(next) => updateAttributes(next)}
      />
    </NodeViewWrapper>
  );
}

/**
 * The one dialog, used both to insert a film and to re-describe one.
 *
 * `attrs.src` being null is what tells it which: inserting asks for the
 * address first, editing shows it filled in.
 */
export function VideoDialog({
  open,
  onOpenChange,
  attrs,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attrs: VideoAttrs;
  onSave: (next: VideoAttrs) => void;
}) {
  const [url, setUrl] = React.useState(attrs.src ?? '');
  const [title, setTitle] = React.useState(attrs.title);
  const [caption, setCaption] = React.useState(attrs.caption);

  React.useEffect(() => {
    if (!open) return;
    setUrl(attrs.src ?? '');
    setTitle(attrs.title);
    setCaption(attrs.caption);
  }, [open, attrs.src, attrs.title, attrs.caption]);

  const source = React.useMemo(() => parseVideoSource(url), [url]);
  const canonical = watchUrl(source);
  const still = thumbnailUrl(source);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{attrs.src ? 'This film' : 'Embed a film'}</DialogTitle>
          <DialogDescription>
            Paste the address from YouTube or Vimeo. The page shows a still and only loads
            the player when somebody presses play.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="video-url">Address</Label>
            <Input
              id="video-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              autoFocus
            />
            {url.trim() !== '' && (
              <p className={cn('text-xs', source ? 'text-muted-foreground' : 'text-destructive')}>
                {source
                  ? `Recognised: ${providerLabel(source)}`
                  : 'That does not name a film. A channel page or a playlist has no video in it.'}
              </p>
            )}
          </div>

          {still && (
            /* A preview of the still, inside a dialog. */
            <img src={still} alt="" className="aspect-video w-full rounded-lg border object-cover" />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="video-title">Title</Label>
            <Input
              id="video-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Walking in to Jomolhari base camp"
            />
            <p className="text-xs text-muted-foreground">
              What the film is. It becomes the name of the link on the page, so somebody
              using a screen reader hears this rather than “Watch the film”.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="video-caption">Caption</Label>
            <Textarea
              id="video-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={2}
              placeholder="Four minutes, filmed on the second morning."
            />
            <p className="text-xs text-muted-foreground">Printed underneath. Optional.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canonical}
            onClick={() => {
              if (!canonical) return;
              onSave({ src: canonical, title: title.trim(), caption: caption.trim() });
              onOpenChange(false);
            }}
          >
            {attrs.src ? 'Save' : 'Insert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
