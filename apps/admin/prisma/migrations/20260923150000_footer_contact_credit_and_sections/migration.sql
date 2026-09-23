-- The footer's credit line and which of its parts draw.
ALTER TABLE "company_profile"
  ADD COLUMN "footerCreditLabel" TEXT NOT NULL DEFAULT 'Website by',
  ADD COLUMN "footerCreditName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "footerCreditUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "footerShowLinks" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "footerShowAddress" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "footerShowContacts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "footerShowSocials" BOOLEAN NOT NULL DEFAULT true;

-- The site's own credit, on the row that already exists. A value rather than a
-- column default, so a fresh install does not credit anybody it did not choose.
UPDATE "company_profile"
  SET "footerCreditName" = 'Trailma', "footerCreditUrl" = 'https://trailma.com';

-- `footerNote` is now the introduction under the name. The seeded note was the
-- company and its town, both of which the footer now prints from the record,
-- so that one exact value is cleared rather than printed twice.
UPDATE "company_profile"
  SET "footerNote" = ''
  WHERE "footerNote" = 'Lotus Peak Tours & Travel · Thimphu, Bhutan';
