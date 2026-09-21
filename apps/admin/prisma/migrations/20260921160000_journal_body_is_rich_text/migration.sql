-- The journal body stops being an array of typed blocks and becomes one
-- rich-text document, as HTML — the same column type, and the same editor, as
-- every other long-form field on this schema.
--
-- The conversion runs here rather than in a script because a migration is the
-- only thing that runs exactly once, on every database, before the code that
-- can no longer read the old shape. A script somebody has to remember to run
-- is a production database full of `[object Object]`.
--
-- What each block becomes:
--
--   text     its own HTML where it holds markup; wrapped in <p> where it is
--            the plain prose most of these blocks actually are
--   heading  <h2>, which is where a body's headings start (H1 is the title)
--   list     <ul> or <ol> of <li><p>, which is what TipTap's list nodes parse
--   quote    <blockquote>, with the attribution as a trailing em-dashed line
--   facts    <h4> label and a two-column <table>, which the site draws as the
--            same bordered pair of columns the facts block drew
--   image    <figure data-media-id>, with no <img> inside it: the URL is not
--            knowable from SQL, and it is filled in from the media row on
--            read anyway (see `resolveRichTextMedia`)
--
-- Blocks are joined with a newline so the result is legible in psql. The
-- renderer does not care.

CREATE FUNCTION "__lp_esc"(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(COALESCE(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

CREATE FUNCTION "__lp_block_html"(block jsonb) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE block->>'kind'

    /* A `text` block was *allowed* to hold HTML and mostly did not: the seeded
       entries are plain prose typed into a box, one paragraph per block with
       the occasional hard break. Passed through unwrapped, those become loose
       text nodes and the entry renders as one unbroken slab — which is what
       the first run of this migration produced. So: markup is kept as it is,
       and prose is wrapped, with a blank line making a paragraph and a single
       newline the line break the writer meant. */
    WHEN 'text' THEN
      CASE WHEN COALESCE(block->>'body', '') ~ '<[a-zA-Z][a-zA-Z0-9]*[^>]*>'
           THEN block->>'body'
           ELSE '<p>'
                || replace(
                     replace("__lp_esc"(block->>'body'), E'\n\n', '</p><p>'),
                     E'\n', '<br>')
                || '</p>'
      END

    WHEN 'heading' THEN '<h2>' || "__lp_esc"(block->>'text') || '</h2>'

    WHEN 'quote' THEN
      '<blockquote>'
      || CASE WHEN COALESCE(block->>'text', '') ~ '<[a-zA-Z][a-zA-Z0-9]*[^>]*>'
              THEN block->>'text'
              ELSE '<p>' || "__lp_esc"(block->>'text') || '</p>' END
      || CASE WHEN COALESCE(block->>'attribution', '') = '' THEN ''
              ELSE '<p><em>— ' || "__lp_esc"(block->>'attribution') || '</em></p>' END
      || '</blockquote>'

    WHEN 'list' THEN
      CASE WHEN COALESCE((block->>'ordered')::boolean, false) THEN '<ol>' ELSE '<ul>' END
      || COALESCE((
           SELECT string_agg('<li><p>' || "__lp_esc"(item) || '</p></li>', '' ORDER BY ord)
           FROM jsonb_array_elements_text(block->'items') WITH ORDINALITY AS t(item, ord)
         ), '')
      || CASE WHEN COALESCE((block->>'ordered')::boolean, false) THEN '</ol>' ELSE '</ul>' END

    WHEN 'facts' THEN
      CASE WHEN COALESCE(block->>'title', '') = '' THEN ''
           ELSE '<h4>' || "__lp_esc"(block->>'title') || '</h4>' END
      || '<table><tbody>'
      || COALESCE((
           SELECT string_agg(
             '<tr><th><p>' || "__lp_esc"(r->>0) || '</p></th><td><p>' || "__lp_esc"(r->>1) || '</p></td></tr>',
             '' ORDER BY ord)
           FROM jsonb_array_elements(block->'rows') WITH ORDINALITY AS t(r, ord)
         ), '')
      || '</tbody></table>'

    WHEN 'image' THEN
      '<figure data-media-id="' || "__lp_esc"(block->>'mediaId') || '"'
      || CASE WHEN COALESCE(block->>'ratio', '') = '' THEN ''
              ELSE ' data-ratio="' || "__lp_esc"(block->>'ratio') || '"' END
      || '></figure>'

    ELSE ''
  END
$$;

ALTER TABLE "posts" ADD COLUMN "body_html" TEXT NOT NULL DEFAULT '';

UPDATE "posts"
SET "body_html" = COALESCE((
  SELECT string_agg("__lp_block_html"(b), E'\n' ORDER BY ord)
  FROM jsonb_array_elements("posts"."body") WITH ORDINALITY AS t(b, ord)
), '')
WHERE jsonb_typeof("body") = 'array';

ALTER TABLE "posts" DROP COLUMN "body";
ALTER TABLE "posts" RENAME COLUMN "body_html" TO "body";

DROP FUNCTION "__lp_block_html"(jsonb);
DROP FUNCTION "__lp_esc"(text);
