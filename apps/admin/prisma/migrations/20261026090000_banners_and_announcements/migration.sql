-- Announcements and banners become things the office can schedule.
--
-- The announcement was one row edited from Company settings — a line of plain
-- text, a link and a switch — and the website never drew it. It becomes a list:
-- each row has a tone, a label, a message in rich text, the pages it appears
-- on, and the dates it runs between (`startsAt` and `endsAt` were already
-- columns; nothing read them). Banners are new: a photograph, a heading, a
-- paragraph and up to two links, drawn above the footer or as a pop-up.
--
-- Soft deletes on both, because "the Losar offer we ran last year" is a row
-- the office will want back next year.

-- CreateEnum
CREATE TYPE "NoticeTone" AS ENUM ('GENERAL', 'OFFER', 'ADVISORY', 'FESTIVAL');

-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('PAGE_END', 'POPUP');

-- CreateEnum
CREATE TYPE "BannerLayout" AS ENUM ('IMAGE_LEFT', 'IMAGE_RIGHT', 'BACKDROP');

-- CreateEnum
CREATE TYPE "BannerTheme" AS ENUM ('PAPER', 'MIST', 'INK');

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "dismissible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hideOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "label" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "showOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tone" "NoticeTone" NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "placement" "BannerPlacement" NOT NULL DEFAULT 'PAGE_END',
    "layout" "BannerLayout" NOT NULL DEFAULT 'IMAGE_RIGHT',
    "theme" "BannerTheme" NOT NULL DEFAULT 'MIST',
    "eyebrow" TEXT,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "imageId" TEXT,
    "href" TEXT,
    "linkLabel" TEXT,
    "secondaryHref" TEXT,
    "secondaryLabel" TEXT,
    "showOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hideOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_isActive_placement_sortOrder_idx" ON "banners"("isActive", "placement", "sortOrder");

-- CreateIndex
CREATE INDEX "announcements_isActive_sortOrder_idx" ON "announcements"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The existing message was plain text, and is rich text from now on. Escaped
-- and wrapped in a paragraph so an ampersand in it stays an ampersand, and
-- only where it is not already markup, so running this twice is harmless.
UPDATE "announcements"
SET "message" = '<p>' || replace(replace(replace("message", '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>'
WHERE "message" <> '' AND "message" NOT LIKE '<%';

UPDATE "announcements" SET "name" = 'Announcement' WHERE "name" = '';
