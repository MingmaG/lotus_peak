-- A reference page's closing note, and the words at the foot of a journey.
ALTER TABLE "pages" ADD COLUMN "note" TEXT;

ALTER TABLE "company_profile"
  ADD COLUMN "journeyPlacesTitle" TEXT NOT NULL DEFAULT 'Where you will go',
  ADD COLUMN "journeyPlacesMore" TEXT NOT NULL DEFAULT 'View more destinations',
  ADD COLUMN "journeyCultureTitle" TEXT NOT NULL DEFAULT 'Culture on the way',
  ADD COLUMN "journeyCultureMore" TEXT NOT NULL DEFAULT 'Know more about the culture',
  ADD COLUMN "journeyJournalTitle" TEXT NOT NULL DEFAULT 'From the journal',
  ADD COLUMN "journeyJournalMore" TEXT NOT NULL DEFAULT 'Read the whole journal',
  ADD COLUMN "journeyRelatedTitle" TEXT NOT NULL DEFAULT 'Other journeys',
  ADD COLUMN "journeyRelatedMore" TEXT NOT NULL DEFAULT 'View more trips';

-- The notes the two pages had typed into their components, moved onto their
-- rows so nothing a visitor reads changes. The company name and town that
-- led the Terms note are not copied: that page now prints them from the
-- company record.
UPDATE "pages" SET "note" = 'Last revised for the 2026 season.'
  WHERE "path" = '/terms' AND "note" IS NULL;
UPDATE "pages" SET "note" = 'Last reviewed for the 2026 season. Ask us if you are reading this later than that.'
  WHERE "path" = '/travellers-information' AND "note" IS NULL;

-- The home page's journeys band now supplies the heading the page had typed
-- in. Only the seeded band is touched: one the office has already retitled
-- keeps its words.
UPDATE "pages"
  SET "sections" = (
    SELECT jsonb_agg(
      CASE
        WHEN s->>'kind' = 'trips' AND s->>'title' = 'Our journeys' AND NOT (s ? 'eyebrow')
          THEN s || '{"eyebrow": "Our trips", "title": "Four journeys, each with time to spare"}'::jsonb
        ELSE s
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements("sections") WITH ORDINALITY AS t(s, ord)
  )
  WHERE "path" = '/' AND jsonb_typeof("sections") = 'array' AND jsonb_array_length("sections") > 0;
