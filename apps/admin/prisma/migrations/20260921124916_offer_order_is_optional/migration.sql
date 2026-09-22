-- A journey may pass through a destination without that destination offering
-- it. Null says so; 0 said "offered, first", which put a journey on a page
-- that had deliberately left it off.
ALTER TABLE "trip_on_destinations" ALTER COLUMN "offerOrder" DROP NOT NULL;
ALTER TABLE "trip_on_destinations" ALTER COLUMN "offerOrder" DROP DEFAULT;
UPDATE "trip_on_destinations" SET "offerOrder" = NULL WHERE "offerOrder" = 0;
