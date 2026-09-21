-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('EXPERIENCE', 'DAY_TOUR', 'RETREAT', 'COURSE', 'TREK', 'FESTIVAL', 'OTHER');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "kind" "ActivityKind" NOT NULL DEFAULT 'EXPERIENCE';

-- AlterTable
ALTER TABLE "departures" ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wasPriceUsd" INTEGER;

-- AlterTable
ALTER TABLE "trip_faqs" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "elevationProfile" JSONB,
ADD COLUMN     "priceCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "priceNote" TEXT,
ADD COLUMN     "routeMapId" TEXT,
ADD COLUMN     "stats" JSONB,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "trip_faq_groups" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blurb" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_faq_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_pricing_tiers" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPeople" INTEGER NOT NULL,
    "maxPeople" INTEGER,
    "priceUsd" INTEGER NOT NULL,
    "wasPriceUsd" INTEGER,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_faq_groups_tripId_sortOrder_idx" ON "trip_faq_groups"("tripId", "sortOrder");

-- CreateIndex
CREATE INDEX "trip_pricing_tiers_tripId_sortOrder_idx" ON "trip_pricing_tiers"("tripId", "sortOrder");

-- CreateIndex
CREATE INDEX "trip_faqs_groupId_sortOrder_idx" ON "trip_faqs"("groupId", "sortOrder");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_routeMapId_fkey" FOREIGN KEY ("routeMapId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_faqs" ADD CONSTRAINT "trip_faqs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "trip_faq_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_faq_groups" ADD CONSTRAINT "trip_faq_groups_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_pricing_tiers" ADD CONSTRAINT "trip_pricing_tiers_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
