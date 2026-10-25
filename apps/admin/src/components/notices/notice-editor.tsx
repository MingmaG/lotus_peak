'use client';

import { Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  Bold,
  Italic,
  Link2,
  Link2Off,
  Smile,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import * as React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * The editor an announcement is written in.
 *
 * Not `RichTextEditor`. That one is for a body somebody reads slowly — headings,
 * lists, tables, photographs — and a bar above the navigation has room for
 * none of them. What it does need, and the long-form editor deliberately does
 * not offer, is a *size* per line: "Losar offer" large, the terms under it
 * small. So this is paragraphs and line breaks, emphasis and links, and a size
 * on each paragraph, stored as `data-size` — one of four the website maps to
 * its own type scale. Never a pixel value: the office chooses "large", the
 * design system decides what large is.
 *
 * Emoji are text, and arrive however the keyboard sends them. The picker is a
 * shortcut for the dozen this office will actually want.
 */

export const NOTICE_SIZES = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Regular' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'Headline' },
] as const;

export type NoticeSize = (typeof NOTICE_SIZES)[number]['value'];

/** `data-size` on a paragraph. Regular is the absence of one. */
const ParagraphSize = Extension.create({
  name: 'paragraphSize',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          size: {
            default: null,
            parseHTML: (element) => {
              const size = element.getAttribute('data-size');
              return size && ['sm', 'lg', 'xl'].includes(size) ? size : null;
            },
            renderHTML: (attributes) =>
              attributes.size ? { 'data-size': attributes.size as string } : {},
          },
        },
      },
    ];
  },
});

const EMOJI = [
  '🎉', '✨', '🏔️', '🪷', '🙏', '🌸', '🍂', '❄️',
  '☀️', '🌧️', '⚠️', '📢', '🎁', '💫', '🧘', '🥾',
  '🏯', '🎊', '📅', '✈️', '🕊️', '🌿', '💛', '➡️',
];

function Tool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}

function currentSize(editor: Editor): NoticeSize {
  return ((editor.getAttributes('paragraph').size as NoticeSize | null) ?? 'md') as NoticeSize;
}

export function NoticeEditor({
  value,
  onChange,
  placeholder = 'What should visitors know?',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['paragraph'] }),
      ParagraphSize,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'lp-notice-edit min-h-[96px] px-4 py-3 text-sm focus:outline-none',
      },
      /* A pasted paragraph keeps its words and loses its formatting: colour
         and font from somewhere else are exactly what this field may not hold. */
      transformPastedHTML: (html) => html.replace(/\sstyle="[^"]*"/gi, ''),
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
    /* The toolbar reflects the caret — which size, whether bold is on. */
    onSelectionUpdate: rerender,
    onTransaction: rerender,
  });

  /* Same rule as the long-form editor: take an outside value only into an
     empty editor, never over somebody typing. */
  React.useEffect(() => {
    if (!editor) return;
    if (value && value !== editor.getHTML() && editor.isEmpty) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) {
    return <div className="h-[140px] animate-pulse rounded-lg border bg-muted/30" />;
  }

  function link() {
    if (!editor) return;
    const existing = (editor.getAttributes('link').href as string | undefined) ?? '';
    const answer = window.prompt('Link address — /trips/losar or https://…', existing);
    if (answer === null) return;
    const trimmed = answer.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  const size = currentSize(editor);

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1">
        <div className="mr-1 flex rounded-md border bg-background p-0.5" role="group" aria-label="Text size">
          {NOTICE_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={size === option.value}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes('paragraph', { size: option.value === 'md' ? null : option.value })
                  .run()
              }
              className={cn(
                'rounded px-2 py-1 text-xs transition-colors',
                size === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Tool label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </Tool>
        <Tool label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </Tool>
        <Tool
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-4" />
        </Tool>
        <Tool label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="size-4" />
        </Tool>

        <span className="mx-1 h-5 w-px bg-border" />

        <Tool label="Link" active={editor.isActive('link')} onClick={link}>
          <Link2 className="size-4" />
        </Tool>
        {editor.isActive('link') && (
          <Tool label="Remove link" onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}>
            <Link2Off className="size-4" />
          </Tool>
        )}

        <span className="mx-1 h-5 w-px bg-border" />

        <Tool
          label="Align left"
          active={!editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="size-4" />
        </Tool>
        <Tool
          label="Centre"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="size-4" />
        </Tool>

        <span className="mx-1 h-5 w-px bg-border" />

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Emoji"
              title="Emoji"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Smile className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => editor.chain().focus().insertContent(emoji).run()}
                  className="rounded p-1 text-lg leading-none hover:bg-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[11px] text-muted-foreground">
              Any emoji works — this is the short list. On a Mac, Control-Command-Space opens the rest.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
