'use client';

import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Heading2,
  Heading3,
  Heading4,
  ImageIcon,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Youtube as YoutubeIcon,
} from 'lucide-react';
import * as React from 'react';

import { MediaMultiPicker, type PickedMedia } from '@/components/media/media-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { Figure } from './figure';
import { cleanPastedHtml, looksLikeMarkdown, markdownToHtml } from './paste';
import { TrailingNode } from './trailing-node';
import { VideoDialog, VideoFigure } from './video';

/**
 * The editor the office writes in.
 *
 * Every field on this site that a visitor reads as more than one sentence uses
 * this. That is the rule, and it is a rule because the alternative was a
 * `<textarea>`: an itinerary day could not carry a link to the monastery it
 * describes, a journal entry could not hold the photograph it was written
 * about, and a table of what to pack had to be typed as lines of dashes.
 *
 * What it produces is HTML, stored in a `String` column and rendered by
 * `Prose` on the website. Not a block array — blocks are right for a *page*,
 * whose sections are furniture that moves around, and wrong for a paragraph,
 * whose shape is the writing itself. The journal was the last field being
 * edited as blocks and is now edited here too, which is why there is one
 * editor on this site and not two.
 *
 * ## What it allows, and why that list is short
 *
 * Headings from H2 down (H1 is the record's title, rendered by the template),
 * bold, italic, underline, strike, inline code, code blocks, both list kinds,
 * quotes, links, photographs from the media library, films from YouTube and
 * Vimeo, tables of any size, rules and alignment.
 *
 * ## Photographs and films are nodes of our own
 *
 * `./figure.tsx` and `./video.tsx`, rather than `@tiptap/extension-image` and
 * `@tiptap/extension-youtube`. Each of those stores a single tag with nowhere
 * to put a caption, a credit or a title, and neither draws anything that says
 * "this is selected" — which is why deleting a photograph appeared not to
 * work. Both files say more about it.
 *
 * Between them, `TrailingNode` and the gap-cursor styling in `globals.css`
 * cover the other half of that complaint: there is always somewhere to put the
 * caret after a photograph, a table or a rule.
 *
 * It does not allow colour, font size or font family. Those are the design
 * system's decisions — see `apps/web/CLAUDE.md` — and a pasted
 * `<span style="color:#f00">` is a design breach nobody sees until it is live.
 * Pasting is where that arrives, so pasting is where it is stripped.
 */

/** The attributes an *unfilled* film dialog opens with. Stable, so the
    dialog's reset effect does not fire on every render of the toolbar. */
const EMPTY_VIDEO = { src: null, title: '', caption: '' } as const;

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Drops images, video and tables — for a field that is one paragraph. */
  compact?: boolean;
  minHeight?: string;
  className?: string;
  disabled?: boolean;
  'aria-labelledby'?: string;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-40',
            active && 'bg-accent text-accent-foreground',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = React.useState('');

  React.useEffect(() => {
    if (open) setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
  }, [open, editor]);

  function apply() {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      /* A bare domain is what somebody types; without a scheme the browser
         reads it as a path and the link points inside this site. */
      const href = /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link</DialogTitle>
          <DialogDescription>
            Leave it empty to remove the link from the selected words.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rte-link">Address</Label>
          <Input
            id="rte-link"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), apply())}
            placeholder="https://… or /trips/jomolhari"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The table controls, which only appear when the caret is inside one. */
function TableControls({ editor }: { editor: Editor }) {
  if (!editor.isActive('table')) return null;

  const actions: [string, () => void][] = [
    ['Row above', () => editor.chain().focus().addRowBefore().run()],
    ['Row below', () => editor.chain().focus().addRowAfter().run()],
    ['Column left', () => editor.chain().focus().addColumnBefore().run()],
    ['Column right', () => editor.chain().focus().addColumnAfter().run()],
    ['Delete row', () => editor.chain().focus().deleteRow().run()],
    ['Delete column', () => editor.chain().focus().deleteColumn().run()],
    ['Merge or split', () => editor.chain().focus().mergeOrSplit().run()],
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-accent/40 px-2 py-1.5">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Table
      </span>
      {actions.map(([label, run]) => (
        <button
          key={label}
          type="button"
          onClick={run}
          className="rounded border bg-background px-2 py-0.5 text-xs hover:bg-accent"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => editor.chain().focus().deleteTable().run()}
        className="ml-auto inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
      >
        <Trash2 className="size-3" />
        Remove table
      </button>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write…',
  compact = false,
  minHeight = 'min-h-[220px]',
  className,
  disabled = false,
  'aria-labelledby': labelledBy,
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [videoOpen, setVideoOpen] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);

  const editor = useEditor({
    /* TipTap renders on the server by default, which mismatches on hydration. */
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: { HTMLAttributes: { class: 'rounded-lg' } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      /**
       * Photographs and films, even in a compact field.
       *
       * The *toolbar* hides the buttons when `compact` is set, because a
       * one-paragraph field has no business offering a table. The **nodes**
       * stay registered either way: a body that already contains a photograph
       * has to round-trip through this editor unharmed, and an extension that
       * is not registered does not politely ignore its node — it drops it, and
       * the first save writes the loss back to the column.
       */
      Figure,
      VideoFigure,
      TrailingNode,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn('lp-prose tiptap px-4 py-3 focus:outline-none', minHeight),
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
      },

      /**
       * What arrives on the clipboard, made into what the schema allows.
       *
       * Returning `false` means "carry on with the default handling", and that
       * is the answer for a paste this does not need to touch. The two it does:
       * HTML from a word processor or a chat assistant, which is structure
       * buried in presentation; and plain-text Markdown, which is structure the
       * default handling would paste as one literal paragraph.
       */
      handlePaste(view, event) {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        const html = clipboard.getData('text/html');
        if (html) {
          const cleaned = cleanPastedHtml(html);
          if (cleaned !== html) {
            event.preventDefault();
            view.pasteHTML(cleaned);
            return true;
          }
          return false;
        }

        const text = clipboard.getData('text/plain');
        if (text && looksLikeMarkdown(text)) {
          event.preventDefault();
          view.pasteHTML(markdownToHtml(text));
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      /* TipTap emits this for an empty document. Storing a real empty string
         keeps "has content" checks and the SEO word count honest. */
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  /**
   * Take an external change, but never mid-sentence.
   *
   * The value flows back in on every keystroke, so replacing the document
   * whenever it differs would fight the person typing. The only change worth
   * taking is one that arrives while this editor is empty — a different
   * journey loaded into the same form.
   */
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== '' && current === '<p></p>') {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className={cn('animate-pulse rounded-lg border bg-muted/30', minHeight, className)} />
    );
  }

  return (
    /**
     * The provider is here, not in the app shell.
     *
     * Radix throws — it does not degrade — when a `Tooltip` has no provider
     * above it, and this editor is mounted from a dozen screens, some of which
     * are their own route. Owning it here means the component works wherever
     * it is put, which is the property a component used in a dozen places
     * needs. Nested providers are harmless; a missing one is a blank screen.
     */
    <TooltipProvider delayDuration={400}>
    <div className={cn('flex flex-col overflow-hidden rounded-lg border bg-background', className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1">
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* H1 is the record's own title, rendered by the template — a body
            starts at H2, and the sizes below it are the site's, not free. */}
        <ToolbarButton
          label="Heading"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Sub-heading"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Small heading"
          active={editor.isActive('heading', { level: 4 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="size-4" />
        </ToolbarButton>
        {!compact && (
          <ToolbarButton
            label="Code block"
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <SquareCode className="size-4" />
          </ToolbarButton>
        )}

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton
          label="Link"
          active={editor.isActive('link')}
          onClick={() => setLinkOpen(true)}
        >
          <Link2 className="size-4" />
        </ToolbarButton>
        {editor.isActive('link') && (
          <ToolbarButton
            label="Remove link"
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Link2Off className="size-4" />
          </ToolbarButton>
        )}

        {!compact && (
          <>
            <MediaMultiPicker
              onPick={(picked: PickedMedia[]) => {
                const chain = editor.chain().focus();
                for (const media of picked) {
                  /* The library's description and caption are the *starting*
                     point — the figure carries its own from here on, because
                     what a photograph means depends on the paragraph it is
                     next to. `mediaId` is the part that is not a copy: it is
                     what the column stores, and what the URL is derived from
                     again on every read. */
                  chain.setFigure({
                    mediaId: media.id,
                    src: media.url,
                    alt: media.isDecorative ? '' : media.alt,
                    caption: media.caption ?? '',
                    credit: media.credit ?? '',
                    title: '',
                  });
                }
                chain.run();
              }}
              trigger={
                <ToolbarButton label="Insert a photograph" onClick={() => undefined}>
                  <ImageIcon className="size-4" />
                </ToolbarButton>
              }
            />
            <ToolbarButton label="Embed a film" onClick={() => setVideoOpen(true)}>
              <YoutubeIcon className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Insert a table"
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            >
              <TableIcon className="size-4" />
            </ToolbarButton>
          </>
        )}

        <ToolbarButton
          label="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

        <div className="hidden items-center gap-0.5 sm:flex">
          <ToolbarButton
            label="Align left"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Align centre"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Align right"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="size-4" />
          </ToolbarButton>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton
            label="Clear the formatting on the selection"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          >
            <RemoveFormatting className="size-4" />
          </ToolbarButton>
          {!compact && (
            <ToolbarButton
              label="Clear everything"
              onClick={() => setClearOpen(true)}
              disabled={editor.isEmpty}
            >
              <Eraser className="size-4" />
            </ToolbarButton>
          )}
          <ToolbarButton
            label="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className="size-4" />
          </ToolbarButton>
        </div>
      </div>

      <TableControls editor={editor} />

      <EditorContent editor={editor} />

      <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
      <VideoDialog
        open={videoOpen}
        onOpenChange={setVideoOpen}
        attrs={EMPTY_VIDEO}
        onSave={(attrs) => editor.chain().focus().setVideoFigure(attrs).run()}
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear everything in this field?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything written here goes. Undo will bring it back until you leave the page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => editor.chain().focus().clearContent(true).run()}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
