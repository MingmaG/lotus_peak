-- The band above the itinerary becomes the office's own.
--
-- "On the trail" was written into the website's journey page: one photograph
-- of four travellers on a ridge, one heading, and one paragraph about pace —
-- on every journey. The paragraph says "two nights in most valleys, drives of
-- no more than five hours, a rest day written in", which is true of the
-- mindfulness journeys, is not what the Jomolhari trek does, and is not
-- really what the festival journey is about either. Changing any of it meant
-- a deploy, and changing it for one journey was not possible at all.
--
-- These five columns are that band as rows. `showTrail` defaults to on and
-- the copy defaults to empty, so a journey created after this migration has
-- the band switched on and nothing in it — which the website draws as
-- nothing, the same rule the five bands at the foot of the page follow.

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "trailEyebrow" TEXT NOT NULL DEFAULT '';
ALTER TABLE "trips" ADD COLUMN "trailTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "trips" ADD COLUMN "trailBody" TEXT NOT NULL DEFAULT '';
ALTER TABLE "trips" ADD COLUMN "trailImageId" TEXT;
ALTER TABLE "trips" ADD COLUMN "showTrail" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "trips" ADD CONSTRAINT "trips_trailImageId_fkey" FOREIGN KEY ("trailImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The words and the photograph the page drew, onto every journey that already
-- exists, so nothing a visitor reads changes on the day this runs.
--
-- The photograph is found by filename rather than by id: the media rows are
-- created by the seed, which generates their ids, so there is no id to write
-- here. A database whose library does not hold that file — one seeded from
-- somewhere else — gets the words and no picture, which the website draws as
-- no band rather than as a scrim over nothing.
--
-- `WHERE "trailTitle" = ''` so that re-running this against a database where
-- somebody has already written their own band cannot overwrite it. Nothing
-- should run a migration twice; a backfill that would be destructive if it
-- did is worth one clause.
UPDATE "trips"
SET
  "trailEyebrow" = 'On the trail',
  "trailTitle"   = 'Walked at a pace that leaves room to notice',
  "trailBody"    = 'Two nights in most valleys. Drives of no more than five hours. A rest day written in. Your guide sets the pace to the slowest step in the group.',
  "trailImageId" = (SELECT "id" FROM "media" WHERE "filename" = 'travellers-hike.webp' LIMIT 1)
WHERE "trailTitle" = '';
