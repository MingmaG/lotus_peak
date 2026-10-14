-- A journey's overview becomes one rich-text document, and the pair of
-- photographs beside it becomes something the office chooses.
--
-- The overview was `text[]`, one row per paragraph, and is now the same kind of
-- column as an itinerary day or a journal entry. The conversion is done here
-- rather than left to the editor: a journey whose overview arrived as an array
-- would otherwise render as nothing the moment the website started reading the
-- column as HTML, and there is no second chance at a down migration on content
-- somebody wrote.
--
-- The two image columns replace a hardcoded asset path on the website, which
-- put the same stock photograph in the corner of every journey's overview.

-- AlterTable: the pair of photographs beside the overview.
ALTER TABLE "trips" ADD COLUMN "overviewImageId" TEXT;
ALTER TABLE "trips" ADD COLUMN "overviewInsetId" TEXT;

ALTER TABLE "trips" ADD CONSTRAINT "trips_overviewImageId_fkey" FOREIGN KEY ("overviewImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_overviewInsetId_fkey" FOREIGN KEY ("overviewInsetId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: overview, text[] -> text holding rich text.
--
-- Written into a new column and renamed over the old one, so the array is
-- still readable while the paragraphs are being built from it. Each paragraph
-- becomes one `<p>`, with the three characters that would otherwise be read as
-- markup escaped — somebody's "Punakha & Phobjikha" must not arrive as a
-- broken entity, and a stray `<` in a sentence must not become a tag the
-- website's allowlist then has an opinion about.
ALTER TABLE "trips" ADD COLUMN "overview_html" TEXT;

UPDATE "trips"
SET "overview_html" = (
  SELECT string_agg(
    '<p>' ||
      replace(replace(replace(btrim(paragraph), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</p>',
    '' ORDER BY ordinality
  )
  FROM unnest("trips"."overview") WITH ORDINALITY AS t(paragraph, ordinality)
  WHERE btrim(paragraph) <> ''
)
WHERE "overview" IS NOT NULL AND cardinality("overview") > 0;

ALTER TABLE "trips" DROP COLUMN "overview";
ALTER TABLE "trips" RENAME COLUMN "overview_html" TO "overview";
