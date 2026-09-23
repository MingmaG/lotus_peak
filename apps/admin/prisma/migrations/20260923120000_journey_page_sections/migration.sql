-- What a journey's page shows below the itinerary, chosen by the office.
--
-- Five switches, one per optional band — the gallery, the places on the
-- route, the culture seen on the way, journal entries and other journeys —
-- all on by default, so every journey keeps the page it had until somebody
-- turns one off. And a join for the culture a journey offers: an empty join
-- falls back to the culture linked to the route, so nothing here needs
-- backfilling.

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "showCulture" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showDestinations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showGallery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showJournal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showRelated" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "culture_on_trips" (
    "cultureId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "culture_on_trips_pkey" PRIMARY KEY ("cultureId","tripId")
);

-- CreateIndex
CREATE INDEX "culture_on_trips_tripId_idx" ON "culture_on_trips"("tripId");

-- AddForeignKey
ALTER TABLE "culture_on_trips" ADD CONSTRAINT "culture_on_trips_cultureId_fkey" FOREIGN KEY ("cultureId") REFERENCES "culture_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culture_on_trips" ADD CONSTRAINT "culture_on_trips_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

