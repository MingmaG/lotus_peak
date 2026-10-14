-- Eight more silhouettes, each a drawing of one place.
--
-- The design system draws fifteen; the enum held seven. Taktsang, Punakha and
-- Jakar had been drawn for a while and were reachable only from the website's
-- file fixture, which meant the two content providers disagreed about what
-- Paro's icon was — the fixture showed the cliff, the panel a generic dzong.
-- Trongsa, Mongar, Pemagatshel, Trashigang and Gasa are new drawings. Adding
-- them here is what lets the office pick any of the fifteen.
--
-- `ADD VALUE` cannot be followed by a statement that uses the new value in the
-- same transaction, so the rows that should now carry one are moved by the
-- migration after this one rather than here.
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'TAKTSANG' AFTER 'BUDDHA';
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'PUNAKHA' AFTER 'TAKTSANG';
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'JAKAR' AFTER 'PUNAKHA';
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'TRONGSA' AFTER 'JAKAR';
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'MONGAR' AFTER 'TRONGSA';
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'PEMAGATSHEL' AFTER 'MONGAR';
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'TRASHIGANG' AFTER 'PEMAGATSHEL';
ALTER TYPE "SiteIcon" ADD VALUE IF NOT EXISTS 'GASA' AFTER 'TRASHIGANG';
