ALTER TABLE "initiatives" ADD COLUMN "waiting_on" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "initiatives" ADD COLUMN "waiting_since" timestamp with time zone;--> statement-breakpoint
-- Initiatives already in "waiting" have waited at least since their last update.
UPDATE "initiatives" SET "waiting_since" = "updated_at" WHERE "status" = 'waiting' AND "waiting_since" IS NULL;
