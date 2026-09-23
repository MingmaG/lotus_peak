/**
 * The journal entries in this folder, and how they become a body.
 *
 * `Post.body` is one rich-text document now. These five entries were written
 * as typed blocks, long before there was a database, and they are kept that
 * way *here* — as a source format — because a block is a legible thing to
 * write in a TypeScript module and a paragraph of escaped HTML is not.
 *
 * {@link blocksToHtml} is the one-way conversion, and it runs where the file
 * provider hands the entries out. The admin panel has its own copy of this
 * conversion in `prisma/seed/journal.ts` and the two are deliberately not
 * shared: that one resolves a photograph to a row in the media library, and
 * this one has no library to resolve to. What they agree on is the *output* —
 * the same handful of elements, so the file provider stays the fixture the API
 * provider is checked against.
 */

export type SeedPostBlock =
  | { kind: 'text'; body: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'image'; src: string; ratio?: string }
  | { kind: 'facts'; title: string; rows: [label: string, value: string][] }

/**
 * A piece of writing as this folder holds it, with the body still in blocks.
 *
 * `region` is the line the old journal printed above the title. The five
 * pieces here were places written up as journal entries; the file provider
 * moves them under Where we go the way the migration moved the database's.
 */
export type SeedPost = {
  slug: string
  title: string
  standfirst: string
  date: string
  region: string
  heroImage: string
  order: number
  body: SeedPostBlock[]
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const HAS_TAG = /<[a-z][a-z0-9]*\b[^>]*>/i

/**
 * A `text` or `quote` block, as paragraphs.
 *
 * These blocks were allowed to hold markup and mostly do not — they are prose
 * typed into a box, one paragraph per block. Unwrapped, that becomes a loose
 * text node and an entry of eleven of them renders as one unbroken slab.
 */
function asParagraphs(value: string): string {
  if (HAS_TAG.test(value)) return value
  return value
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/**
 * Blocks → the HTML a body is.
 *
 * Matches the conversion the database migration ran over the real entries
 * (`20260921160000_journal_body_is_rich_text`), element for element, so the
 * two providers render the same document from the same writing:
 *
 * - a `facts` block is an `<h4>` label and a two-column table, which is what
 *   the design drew it as and what a crawler can read as a table of values
 * - a `quote` keeps its `<blockquote>`
 * - an `image` becomes a `<figure>`, because a photograph in a body carries a
 *   description and may carry a caption
 *
 * A `text` block keeps its markup where it has any and is wrapped in `<p>`
 * where it does not. Everything else is escaped on the way in — these are
 * strings somebody typed, and a `<` in one of them is a less-than sign.
 */
export function blocksToHtml(
  blocks: SeedPostBlock[],
  altFor: (src: string) => string | undefined,
): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case 'text':
          return asParagraphs(block.body)

        case 'heading':
          return `<h2>${escapeHtml(block.text)}</h2>`

        case 'quote':
          return `<blockquote>${asParagraphs(block.text)}</blockquote>`

        case 'list':
          return `<ul>${block.items
            .map((item) => `<li><p>${escapeHtml(item)}</p></li>`)
            .join('')}</ul>`

        case 'facts':
          return (
            `<h4>${escapeHtml(block.title)}</h4><table><tbody>` +
            block.rows
              .map(
                ([label, value]) =>
                  `<tr><th><p>${escapeHtml(label)}</p></th><td><p>${escapeHtml(value)}</p></td></tr>`,
              )
              .join('') +
            `</tbody></table>`
          )

        case 'image': {
          /* The description lives in `src/lib/assets.ts` for this provider,
             the way it lives in the `Media` row for the other one. Either way
             it is joined to the photograph here and not written into the copy. */
          const alt = altFor(block.src) ?? ''
          const ratio = block.ratio ? ` data-ratio="${escapeHtml(block.ratio)}"` : ''
          return (
            `<figure data-alt="${escapeHtml(alt)}"${ratio}>` +
            `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(alt)}">` +
            `</figure>`
          )
        }
      }
    })
    .join('\n')
}
