'use client';

import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Link2, Link2Off } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Prose, with the formatting the design can render and nothing else.
 *
 * Bold, italic, a link. No headings — those are their own block, so the
 * document's outline is a real outline rather than something a crawler infers
 * from font sizes. No colour, no font size, no alignment: those are the design
 * system's decisions, and a toolbar offering them is a toolbar that makes
 * every entry look slightly different.
 *
 * ## Paste is the real threat, not the toolbar
 *
 * Nobody types `<span style="mso-fareast-font-family">` — they paste it, out
 * of Word or a browser, along with a stylesheet's worth of inline attributes.
 * TipTap's schema is the defence: anything with no node or mark in the schema
 * is dropped on the way in, so a pasted Word document arrives as paragraphs
 * with its bold intact and everything else gone.
 */
export function RichTextField({
  value,
  onChange,
  placeholder,
  /** True for a quotation: no lists, no links, just emphasis. */
  plain = false,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  plain?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    /**
     * Rendered only in the browser.
     *
     * Without this, TipTap renders once on the server and again on hydration,
     * and React reports a mismatch on every one of these fields. There is no
     * SEO cost — this is an admin panel — and the field is a plain box for the
     * few milliseconds before it mounts.
     */
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: plain ? false : undefined,
        orderedList: plain ? false : undefined,
        listItem: plain ? false : undefined,
      }),
      ...(plain
        ? []
        : [
            Link.configure({
              openOnClick: false,
              /* `rel` and a scheme allowlist. A pasted `javascript:` URL in a
                 field the office will publish is the obvious hole here. */
              protocols: ['http', 'https', 'mailto', 'tel'],
              HTMLAttributes: { rel: 'noopener noreferrer' },
            }),
          ]),
      Placeholder.configure({ placeholder: placeholder ?? 'Write…' }),
    ],
    content: value,
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      /* TipTap's empty document is `<p></p>`, which would save as content. */
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class:
          'min-h-20 w-full px-3 py-2 text-sm leading-relaxed outline-none [&_p]:m-0 [&_p+p]:mt-3 [&_a]:underline [&_a]:decoration-gold [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
      },
    },
  });

  /**
   * Keeps the editor in step when the value is replaced from outside.
   *
   * Only when they actually differ: writing the content back on every render
   * moves the cursor to the end of the document on every keystroke.
   */
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '<p></p>';
    if (current !== incoming) {
      /* `false` is the v2 signature for "do not emit an update". Emitting one
         here would call `onChange` with the value that just arrived, which in
         a controlled field is a render loop. */
      editor.commands.setContent(incoming, false);
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={cn('min-h-20 rounded-md border bg-background px-3 py-2', className)} />
    );
  }

  return (
    <div className={cn('rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring', className)}>
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
        <ToolbarButton
          active={editor.isActive('bold')}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive('italic')}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </ToolbarButton>

        {!plain && (
          <>
            <ToolbarButton
              active={editor.isActive('link')}
              label="Add a link"
              onClick={() => {
                const previous = editor.getAttributes('link').href as string | undefined;
                const href = window.prompt('Where should it link to?', previous ?? 'https://');
                if (href === null) return;
                if (href === '') {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  return;
                }
                editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
              }}
            >
              <Link2 className="size-3.5" />
            </ToolbarButton>

            {editor.isActive('link') && (
              <ToolbarButton
                label="Remove the link"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                <Link2Off className="size-3.5" />
              </ToolbarButton>
            )}
          </>
        )}
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn('size-7 p-0', active && 'bg-muted')}
    >
      {children}
    </Button>
  );
}
