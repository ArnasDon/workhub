CREATE TYPE "public"."entry_kind" AS ENUM('update', 'decision', 'blocker', 'meeting', 'status', 'task');--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "kind" "entry_kind" DEFAULT 'update' NOT NULL;--> statement-breakpoint
CREATE INDEX "log_entries_kind_created_idx" ON "log_entries" USING btree ("kind","created_at");--> statement-breakpoint
-- Backfill: status transitions written before kinds existed follow one exact pattern.
UPDATE "log_entries" SET "kind" = 'status' WHERE "body" LIKE 'Status: % → %' AND "kind" = 'update';
