-- A booking's paid figure becomes net of refunds.
--
-- Renamed rather than added: the list screen filters "paid in full" with a SQL
-- comparison against "totalCents", which cannot subtract a second column — so
-- the gross figure counted a booking that had been taken and refunded in full
-- as paid, while the badge beside it read "Refunded". A rename keeps the
-- existing rows and their history; the UPDATE below makes them true under the
-- new meaning.
ALTER TABLE "bookings" RENAME COLUMN "paidCents" TO "netPaidCents";

UPDATE "bookings" SET "netPaidCents" = "netPaidCents" - "refundedCents";
