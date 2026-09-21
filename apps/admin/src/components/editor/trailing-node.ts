import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Keeps an empty paragraph at the end of the document.
 *
 * Without it, a document that ends in a photograph, a film, a table or a rule
 * ends in something the caret cannot go after. The gap cursor covers *some* of
 * that — it is why `.ProseMirror-gapcursor` is styled in `globals.css` — but a
 * gap cursor is a thing you have to know exists, and the complaint that
 * started this work was exactly the shape it has when you do not: "I put a
 * photograph in and now I cannot type underneath it."
 *
 * So: if the last node is one of the block nodes that cannot hold a caret, a
 * paragraph is appended. It is an ordinary empty paragraph, which TipTap emits
 * as `<p></p>` and the website's sanitiser draws as nothing, so the cost of
 * the one that gets left behind is a blank line in a column and nothing on a
 * page.
 *
 * Thirty lines rather than a dependency, per the rule in `CLAUDE.md`.
 */

/** The block nodes with no place to put a caret after them. */
const NEEDS_TRAILING = new Set([
  'figure',
  'videoFigure',
  'table',
  'horizontalRule',
  'codeBlock',
  'blockquote',
]);

export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('trailingNode'),

        appendTransaction(_transactions, _oldState, newState) {
          const { doc, tr, schema } = newState;
          const last = doc.lastChild;

          if (!last || !NEEDS_TRAILING.has(last.type.name)) return null;

          const paragraph = schema.nodes.paragraph;
          if (!paragraph) return null;

          /* `doc.content.size` is the position after everything, which is where
             the paragraph goes. Returning the transaction rather than
             dispatching it is what makes this one undo step with the edit that
             caused it — otherwise Ctrl-Z removes the paragraph and leaves the
             photograph, twice. */
          return tr.insert(doc.content.size, paragraph.create());
        },
      }),
    ];
  },
});
