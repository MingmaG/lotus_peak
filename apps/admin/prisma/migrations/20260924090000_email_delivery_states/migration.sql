-- Everything between "we recorded it" and "it arrived".
--
-- The log stopped at SENT, which is the limit of what a send call can honestly
-- report: the provider accepted the message. Acceptance is not arrival, and
-- every interesting outcome — bounced, marked as spam, delayed — happens
-- minutes later and is only knowable from the webhook. These are the columns
-- that let it be written down.

-- PROCESSING is "handed over, no answer yet", so a row that stays there is a
-- real signal rather than an invisible one. SKIPPED is "never attempted",
-- which is not the same as a refusal: the day's allowance was already spent.
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'SENT';
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'SKIPPED' AFTER 'FAILED';

ALTER TABLE "email_messages"
  ADD COLUMN "replyTo" TEXT,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedAt" TIMESTAMP(3);

-- Everything already in the log was handed over exactly once, or not at all.
UPDATE "email_messages" SET "attempts" = 1 WHERE "status" <> 'QUEUED';
UPDATE "email_messages" SET "failedAt" = "updatedAt" WHERE "status" = 'FAILED';

-- The provider's id is the only thing a webhook carries that means anything
-- here, so it is how an event finds its row. Nulls do not collide in Postgres,
-- which is what makes this safe on a table of messages that were never sent.
CREATE UNIQUE INDEX "email_messages_providerId_key" ON "email_messages" ("providerId");

-- An event is the provider's own event name, stored as written: a provider
-- adding a type should show up in the log rather than fail the webhook. The
-- status it moved the message to is now nullable, because some events move
-- nothing — `email.sent` is already recorded by the send call, and an event
-- arriving late must not walk DELIVERED backwards.
ALTER TABLE "email_events"
  ADD COLUMN "type" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "status" DROP NOT NULL;

UPDATE "email_events"
  SET "occurredAt" = "createdAt",
      "type" = 'email.' || lower("status"::text)
  WHERE "type" = '';

-- The default existed only to fill the rows above. A new event names its type.
ALTER TABLE "email_events" ALTER COLUMN "type" DROP DEFAULT;

CREATE INDEX "email_events_type_idx" ON "email_events" ("type");
