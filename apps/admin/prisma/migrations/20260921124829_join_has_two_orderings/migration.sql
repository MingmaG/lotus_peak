-- `trip_on_destinations` is read from both ends and the two orderings differ:
-- a journey lists its places in route order, a destination lists its journeys
-- in the order the office wants them offered. One column carried the first and
-- silently reordered the second.
--
-- The existing `sortOrder` held the route order, so it is renamed rather than
-- dropped, and `offerOrder` starts at 0 for every row — the seed sets it, and
-- an install that does not re-seed gets the rows in a stable (0, id) order
-- rather than a random one.
ALTER TABLE "trip_on_destinations" RENAME COLUMN "sortOrder" TO "routeOrder";
ALTER TABLE "trip_on_destinations" ADD COLUMN "offerOrder" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "trip_on_destinations_destinationId_idx";
CREATE INDEX "trip_on_destinations_destinationId_offerOrder_idx"
  ON "trip_on_destinations"("destinationId", "offerOrder");
CREATE INDEX "trip_on_destinations_tripId_routeOrder_idx"
  ON "trip_on_destinations"("tripId", "routeOrder");
