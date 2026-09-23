-- Where we go, Culture, Journal: three sections that no longer overlap.
--
-- Before this, the journal was doing a destination's job. Its five entries
-- were Taktsang, Thimphu, Punakha Dzong, Bumthang and Trongsa Dzong — places —
-- while /destinations described the same valleys a second time, and a culture
-- piece was a paragraph on an index page with no address of its own.
--
-- After it:
--
--   Where we go  a valley, or a place inside one (`parentId`), each a page
--   Culture      what makes Bhutan Bhutan, each a page
--   Journal      dated editorial, on one of four shelves (`category`), linked
--                to the places and the culture it is about
--
-- Nothing written is dropped. `detail` and `region` are carried into their new
-- homes before their columns go, the five place pieces are moved rather than
-- deleted, and every journal URL they had answers with a 301.
--
-- A fresh database runs this against empty tables and every statement below
-- the DDL matches nothing; the seed then writes the new shape directly. A
-- database that already has the old content gets it moved. The seed data is
-- written to produce the same rows this produces, so the two agree.

-- CreateEnum
CREATE TYPE "JournalCategory" AS ENUM ('JOURNEYS', 'TRAVEL_GUIDES', 'EXPERIENCES', 'STORIES');

-- New columns first; the old ones go at the end, once they have been read.
ALTER TABLE "culture_articles" ADD COLUMN "standfirst" TEXT NOT NULL DEFAULT '';

ALTER TABLE "destinations"
  ADD COLUMN "body" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "standfirst" TEXT NOT NULL DEFAULT '';

ALTER TABLE "posts" ADD COLUMN "category" "JournalCategory" NOT NULL DEFAULT 'STORIES';

-- CreateTable
CREATE TABLE "post_on_destinations" (
    "postId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_on_destinations_pkey" PRIMARY KEY ("postId","destinationId")
);

CREATE TABLE "post_on_culture" (
    "postId" TEXT NOT NULL,
    "cultureId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_on_culture_pkey" PRIMARY KEY ("postId","cultureId")
);

CREATE TABLE "culture_on_destinations" (
    "cultureId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "culture_on_destinations_pkey" PRIMARY KEY ("cultureId","destinationId")
);

CREATE INDEX "post_on_destinations_destinationId_idx" ON "post_on_destinations"("destinationId");
CREATE INDEX "post_on_culture_cultureId_idx" ON "post_on_culture"("cultureId");
CREATE INDEX "culture_on_destinations_destinationId_idx" ON "culture_on_destinations"("destinationId");
CREATE INDEX "destinations_parentId_sortOrder_idx" ON "destinations"("parentId", "sortOrder");
CREATE INDEX "posts_category_status_publishedAt_idx" ON "posts"("category", "status", "publishedAt");

ALTER TABLE "destinations" ADD CONSTRAINT "destinations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "post_on_destinations" ADD CONSTRAINT "post_on_destinations_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_on_destinations" ADD CONSTRAINT "post_on_destinations_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_on_culture" ADD CONSTRAINT "post_on_culture_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_on_culture" ADD CONSTRAINT "post_on_culture_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "culture_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "culture_on_destinations" ADD CONSTRAINT "culture_on_destinations_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "culture_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "culture_on_destinations" ADD CONSTRAINT "culture_on_destinations_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- A paragraph becomes a standfirst and a body.
--
-- The old `detail` (and a culture piece's `body`) was one paragraph on an
-- index page. On a page of its own the first sentence is the standfirst —
-- under the title, on the card, in the meta description — and the rest is the
-- start of the body.
--
-- Split only where the paragraph is plain text, which is what the seed wrote.
-- One the office has since formatted in the editor keeps its markup whole in
-- the body and lends its first sentence to the standfirst: a repeated sentence
-- is a thing somebody tidies in a minute, a lost link is a thing nobody notices.
-- ---------------------------------------------------------------------------

CREATE FUNCTION pg_temp.lp_plain(html TEXT) RETURNS TEXT AS $$
  SELECT btrim(regexp_replace(
    replace(replace(regexp_replace(coalesce(html, ''), '<[^>]+>', ' ', 'g'), '&nbsp;', ' '), '&amp;', '&'),
    '\s+', ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION pg_temp.lp_first_sentence(plain TEXT) RETURNS TEXT AS $$
  SELECT coalesce(substring(plain FROM '^.*?[.!?](?=\s|$)'), plain)
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION pg_temp.lp_paragraph(plain TEXT) RETURNS TEXT AS $$
  SELECT CASE WHEN btrim(plain) = '' THEN ''
    ELSE '<p>' || replace(replace(replace(btrim(plain), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>'
  END
$$ LANGUAGE sql IMMUTABLE;

UPDATE "destinations" SET
  "standfirst" = pg_temp.lp_first_sentence(pg_temp.lp_plain("detail")),
  "body" = CASE
    WHEN "detail" ~ '<[a-zA-Z]' THEN "detail"
    ELSE pg_temp.lp_paragraph(substr(pg_temp.lp_plain("detail"),
           length(pg_temp.lp_first_sentence(pg_temp.lp_plain("detail"))) + 1))
  END;

UPDATE "culture_articles" SET
  "standfirst" = pg_temp.lp_first_sentence(pg_temp.lp_plain("body")),
  "body" = CASE
    WHEN "body" ~ '<[a-zA-Z]' THEN "body"
    ELSE pg_temp.lp_paragraph(substr(pg_temp.lp_plain("body"),
           length(pg_temp.lp_first_sentence(pg_temp.lp_plain("body"))) + 1))
  END;

-- ---------------------------------------------------------------------------
-- Meta descriptions that were only ever copies.
--
-- The old seed wrote each valley's blurb, and the first 155 characters of each
-- culture paragraph, into `metaDescription` — which the SEO tab treats as an
-- override. Left in place, a copy pins the search result to the old words
-- however the standfirst is rewritten. A value that still equals what it was
-- copied from is not anybody's decision, so it goes, and the page falls back
-- to its standfirst. Anything the office actually typed is left alone.
-- ---------------------------------------------------------------------------

UPDATE "destinations" SET "metaDescription" = NULL
WHERE "metaDescription" IN ("blurb", "standfirst");

UPDATE "culture_articles" SET "metaDescription" = NULL
WHERE "metaDescription" = "standfirst"
   OR "metaDescription" = left(pg_temp.lp_plain("standfirst" || ' ' || pg_temp.lp_plain("body")), 155);

-- ---------------------------------------------------------------------------
-- An entry's `region` becomes a link to the place it names.
--
-- Matched by name, which is how the region line was always meant: "Paro" is
-- the Paro row. A region that names nothing on /destinations is dropped with
-- its column — it was a label with nowhere to point.
-- ---------------------------------------------------------------------------

INSERT INTO "post_on_destinations" ("postId", "destinationId", "sortOrder")
SELECT p."id", d."id", 0
FROM "posts" p
JOIN "destinations" d ON lower(d."name") = lower(btrim(p."region")) AND d."deletedAt" IS NULL
WHERE btrim(p."region") <> ''
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- The three place pieces become places.
--
-- Taktsang, Punakha Dzong and Trongsa Dzong were journal entries describing a
-- place. They are places now, inside the valley each one is in, and they keep
-- their writing, their photograph, their SEO fields and their publishing
-- state. The entry is soft-deleted rather than removed so that it can be
-- looked at again, and its URL — and any older URL that already pointed at
-- it — redirects to the place.
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE lp_place_moves (post_slug TEXT, parent_slug TEXT, icon "SiteIcon", blurb TEXT) ON COMMIT DROP;
INSERT INTO lp_place_moves VALUES
  ('taktsang',      'paro',    'MONASTERY',  'The temple on the cliff above the Paro valley'),
  ('punakha-dzong', 'punakha', 'DZONG_LONG', 'The Palace of Great Happiness, between two rivers'),
  ('trongsa-dzong', 'trongsa', 'DZONG',      'The ancestral seat of the Wangchuck dynasty');

INSERT INTO "destinations" (
  "id", "slug", "name", "icon", "blurb", "detail", "standfirst", "body", "parentId", "imageId",
  "sortOrder", "status", "publishedAt",
  "metaTitle", "metaDescription", "canonicalUrl", "noIndex", "noFollow", "ogTitle",
  "ogDescription", "ogImageId", "twitterCard", "keywords", "focusKeyword", "schemaJson",
  "sitemapPriority", "sitemapChangeFreq", "slugHistory", "createdAt", "updatedAt"
)
SELECT
  'place_' || p."id", p."slug", p."title", m.icon, m.blurb, '', p."standfirst", p."body", parent."id", p."heroId",
  row_number() OVER (PARTITION BY parent."id" ORDER BY p."sortOrder") - 1, p."status", p."publishedAt",
  p."metaTitle", NULLIF(p."metaDescription", p."standfirst"), NULL, p."noIndex", p."noFollow", p."ogTitle",
  p."ogDescription", p."ogImageId", p."twitterCard", p."keywords", p."focusKeyword", p."schemaJson",
  p."sitemapPriority", p."sitemapChangeFreq", '{}', p."createdAt", now()
FROM "posts" p
JOIN lp_place_moves m ON m.post_slug = p."slug"
JOIN "destinations" parent ON parent."slug" = m.parent_slug AND parent."deletedAt" IS NULL
WHERE p."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "destinations" d WHERE d."slug" = p."slug");

-- ---------------------------------------------------------------------------
-- The two valley pieces fold into their valley.
--
-- "Thimphu" and "Bumthang" were the valley pages the site did not have. Their
-- writing is appended to the valley's body, and the valley takes the entry's
-- photograph only if it had none.
-- ---------------------------------------------------------------------------

UPDATE "destinations" d SET
  /* A newline between them, as the seed joins blocks, so a migrated body and
     a seeded one are the same bytes. */
  "body" = d."body" || CASE WHEN d."body" <> '' THEN E'\n' ELSE '' END || p."body",
  "imageId" = coalesce(d."imageId", p."heroId"),
  "updatedAt" = now()
FROM "posts" p
WHERE p."slug" = d."slug"
  AND p."slug" IN ('thimphu', 'bumthang')
  AND p."deletedAt" IS NULL
  AND d."parentId" IS NULL;

-- Where each moved entry now lives.
CREATE TEMP TABLE lp_journal_moves ON COMMIT DROP AS
SELECT p."id" AS post_id, p."slug" AS post_slug, '/destinations/' || parent."slug" || '/' || d."slug" AS target
FROM "posts" p
JOIN "destinations" d ON d."id" = 'place_' || p."id"
JOIN "destinations" parent ON parent."id" = d."parentId"
WHERE p."deletedAt" IS NULL
UNION ALL
SELECT p."id", p."slug", '/destinations/' || d."slug"
FROM "posts" p
JOIN "destinations" d ON d."slug" = p."slug" AND d."parentId" IS NULL
WHERE p."slug" IN ('thimphu', 'bumthang') AND p."deletedAt" IS NULL;

-- Older redirects that pointed at a moved entry follow it, so there is never
-- a chain of two hops for a crawler to give up on.
UPDATE "redirects" r SET "target" = m.target, "updatedAt" = now()
FROM lp_journal_moves m
WHERE r."target" = '/journal/' || m.post_slug;

INSERT INTO "redirects" ("id", "source", "target", "type", "isActive", "note", "isAutomatic", "createdAt", "updatedAt")
SELECT 'moved_' || m.post_id, '/journal/' || m.post_slug, m.target, 'MOVED_301', true,
       'Moved out of the journal when Where we go got pages of its own.', true, now(), now()
FROM lp_journal_moves m
ON CONFLICT ("source") DO UPDATE SET "target" = EXCLUDED."target", "isActive" = true, "updatedAt" = now();

UPDATE "posts" p SET "deletedAt" = now(), "status" = 'ARCHIVED', "updatedAt" = now()
FROM lp_journal_moves m
WHERE p."id" = m.post_id;

-- The link the region line made for a moved entry points at the place it
-- became. Left in, it would list an archived entry on that place's page.
DELETE FROM "post_on_destinations" x
USING lp_journal_moves m
WHERE x."postId" = m.post_id;

-- ---------------------------------------------------------------------------
-- Culture, and where to see it.
--
-- Only the two pairs the existing writing already states: Paro and Thimphu
-- tshechus, and the two dzongs that are places of their own. Anything more is
-- an editorial call for the office, made on the culture piece's Links tab.
-- ---------------------------------------------------------------------------

INSERT INTO "culture_on_destinations" ("cultureId", "destinationId", "sortOrder")
SELECT c."id", d."id", pairs.position
FROM (VALUES
  ('tshechu', 'paro', 0), ('tshechu', 'thimphu', 1),
  ('dzongs', 'punakha-dzong', 0), ('dzongs', 'trongsa-dzong', 1)
) AS pairs(culture_slug, destination_slug, position)
JOIN "culture_articles" c ON c."slug" = pairs.culture_slug
JOIN "destinations" d ON d."slug" = pairs.destination_slug
ON CONFLICT DO NOTHING;

-- Now the old columns can go.
ALTER TABLE "destinations" DROP COLUMN "detail";
ALTER TABLE "posts" DROP COLUMN "region";
