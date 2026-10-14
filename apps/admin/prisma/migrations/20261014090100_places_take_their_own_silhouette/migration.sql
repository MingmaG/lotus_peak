-- The seven destinations that now have a drawing of themselves.
--
-- Separate from the migration that added the values because Postgres refuses
-- to use a new enum value in the transaction that created it.
--
-- Each update names the icon the row still carries as well as its slug, so a
-- row the office has already chosen an icon for is left exactly as it is. This
-- corrects the seeded default, nothing else: an office that has decided Paro
-- is better as a plain dzong keeps its decision.
UPDATE "destinations" SET "icon" = 'TAKTSANG'
  WHERE "slug" = 'paro' AND "icon" = 'DZONG';
UPDATE "destinations" SET "icon" = 'PUNAKHA'
  WHERE "slug" = 'punakha' AND "icon" = 'DZONG_LONG';
UPDATE "destinations" SET "icon" = 'JAKAR'
  WHERE "slug" = 'bumthang' AND "icon" = 'MONASTERY';
UPDATE "destinations" SET "icon" = 'TRONGSA'
  WHERE "slug" = 'trongsa' AND "icon" = 'CHORTEN';

-- The three places inside them, which are the same buildings seen closer.
UPDATE "destinations" SET "icon" = 'TAKTSANG'
  WHERE "slug" = 'taktsang' AND "icon" = 'MONASTERY';
UPDATE "destinations" SET "icon" = 'PUNAKHA'
  WHERE "slug" = 'punakha-dzong' AND "icon" = 'DZONG_LONG';
UPDATE "destinations" SET "icon" = 'TRONGSA'
  WHERE "slug" = 'trongsa-dzong' AND "icon" = 'DZONG';
