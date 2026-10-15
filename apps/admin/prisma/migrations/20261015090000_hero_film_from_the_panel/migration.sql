-- What plays behind the home page's headline becomes the office's choice.
--
-- The hero has been able to play a photograph, an MP4 from the website's own
-- origin, or a film on YouTube since the website gained `lib/hero-media.ts` —
-- but the choice was a constant in that file, so trying a film meant a deploy
-- and the office could not try one at all.
--
-- These two columns are that choice, beside `strapline`, which is already the
-- hero's words. `heroMedia` takes `image` or `youtube`; the panel's Zod schema
-- is the allowlist, as it is for `twitterCard`. `heroYoutubeUrl` is kept when
-- the photograph is showing, so a film can be put back without being retyped.
--
-- The default is `image`, which is what every existing row means: the hero was
-- a photograph before this migration ran, and is one after it.

-- AlterTable
ALTER TABLE "company_profile" ADD COLUMN "heroMedia" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "company_profile" ADD COLUMN "heroYoutubeUrl" TEXT;
